import { NextResponse } from 'next/server';
import { getParserForUrl } from '@/lib/parsers';
import { extractUrl, validateUrl } from '@/lib/utils/url';
import prisma from '@/lib/prisma';
import { isEmbedUrl } from '@/lib/utils';
import { uploadMediaToR2 } from '@/lib/r2';
import crypto from 'crypto';
import { notifyNewPostCreated } from '@/lib/notification';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

const getErrorStack = (error: unknown) =>
  error instanceof Error ? error.stack : undefined;

export async function POST(req: Request) {
  let url = 'unknown';
  try {
    const body = await req.json();
    const rawUrl = body.url;

    if (!rawUrl) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const trimmedRawUrl = rawUrl.trim();
    url = extractUrl(trimmedRawUrl) || trimmedRawUrl; 

    if (!validateUrl(url)) {
      await prisma.urlSubmission.create({
          data: { url, source: 'WEB', status: 'REJECTED', errorMessage: 'Invalid or unsafe URL' }
      });
      return NextResponse.json({ error: 'Invalid or unsafe URL provided' }, { status: 400 });
    }

    const parser = getParserForUrl(url);
    const parsedData = await parser.parse(url);

    // Pre-generate Post ID for R2 folder organization
    const postId = crypto.randomUUID();
    const originalMediaUrls = parsedData.mediaUrls || [];
    const mediaUrls: string[] = [];

    // Persist media to Cloudflare R2 if it's not an embed (like Bilibili/YT)
    for (const mediaUrl of originalMediaUrls) {
        if (isEmbedUrl(mediaUrl)) {
            mediaUrls.push(mediaUrl);
            continue;
        }

        const r2Url = await uploadMediaToR2(mediaUrl, postId, url);
        if (r2Url) {
            mediaUrls.push(r2Url);
        } else {
            // Fallback to original URL if upload fails
            mediaUrls.push(mediaUrl);
        }
    }

    const post = await prisma.post.create({
      data: {
        id: postId,
        originalUrl: url,
        platform: parsedData.platform,
        authorName: parsedData.authorName,
        avatarUrl: parsedData.avatarUrl,
        title: parsedData.title,
        contentText: parsedData.contentText,
        mediaUrls: mediaUrls,
        originalMediaUrls: originalMediaUrls,
      }
    });

    await prisma.urlSubmission.create({
        data: { url, source: 'WEB', status: 'SUCCESS', postId: post.id }
    });

    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
      await notifyNewPostCreated(
        post.platform,
        post.title,
        'WEB',
        `${siteUrl}/#${post.id}`,
      );
    } catch (notificationError) {
      console.error('Failed to send new post Bark notification:', notificationError);
    }

    return NextResponse.json({ success: true, data: post }, { status: 201 });
    } catch (error: unknown) {
    console.error('------- [API CRASH] Error parsing feed URL -------');
    console.error(error);
    const errorMessage = getErrorMessage(error);

    // Log failure
    try {
        await prisma.urlSubmission.create({
            data: { url, source: 'WEB', status: 'FAILED', errorMessage }
        });
    } catch (e) {
        console.error('Failed to log URL submission failure:', e);
    }

    return NextResponse.json({
      error: errorMessage || 'Failed to parse URL',

      details: process.env.NODE_ENV !== 'production' ? getErrorStack(error) : undefined 
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const cursor = searchParams.get('cursor');
        const since = searchParams.get('since');
        const limitStr = searchParams.get('limit');
        const limit = limitStr ? parseInt(limitStr) : 10;

        // Efficient Polling: Fetch only new items since the top item
        if (since) {
            const referencePost = await prisma.post.findUnique({
                where: { id: since },
                select: { createdAt: true }
            });

            if (!referencePost) {
                return NextResponse.json({ success: true, data: [], hasMore: false });
            }

            const newPosts = await prisma.post.findMany({
                where: {
                    createdAt: {
                        gt: referencePost.createdAt
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            return NextResponse.json({ success: true, data: newPosts, hasMore: false });
        }

        // Standard Pagination: Fetch posts with cursor
        const posts = await prisma.post.findMany({
            take: limit + 1, // Fetch one extra to determine if there are more
            cursor: cursor ? { id: cursor } : undefined,
            skip: cursor ? 1 : 0,
            orderBy: { createdAt: 'desc' }
        });

        const hasMore = posts.length > limit;
        const data = hasMore ? posts.slice(0, limit) : posts;
        const nextCursor = hasMore ? data[data.length - 1].id : null;

        return NextResponse.json({ 
            success: true, 
            data, 
            nextCursor,
            hasMore
        });
    } catch (error: unknown) {
        console.error('Error fetching timeline:', error);
        return NextResponse.json({ error: 'Failed to fetch timeline' }, { status: 500 });
    }
}
