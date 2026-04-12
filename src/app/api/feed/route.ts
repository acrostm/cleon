import { NextResponse } from 'next/server';
import { getParserForUrl } from '@/lib/parsers';
import { extractUrl, validateUrl } from '@/lib/utils/url';
import prisma from '@/lib/prisma';

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

    const post = await prisma.post.create({
      data: {
        originalUrl: url,
        platform: parsedData.platform,
        authorName: parsedData.authorName,
        avatarUrl: parsedData.avatarUrl,
        title: parsedData.title,
        contentText: parsedData.contentText,
        mediaUrls: parsedData.mediaUrls || [],
      }
    });

    await prisma.urlSubmission.create({
        data: { url, source: 'WEB', status: 'SUCCESS', postId: post.id }
    });

    return NextResponse.json({ success: true, data: post }, { status: 201 });
    } catch (error: any) {
    console.error('------- [API CRASH] Error parsing feed URL -------');
    console.error(error);

    // Log failure
    try {
        await prisma.urlSubmission.create({
            data: { url, source: 'WEB', status: 'FAILED', errorMessage: error.message }
        });
    } catch (e) {
        console.error('Failed to log URL submission failure:', e);
    }

    return NextResponse.json({
      error: error.message || 'Failed to parse URL',

      details: process.env.NODE_ENV !== 'production' ? error.stack : undefined 
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
    } catch (error: any) {
        console.error('Error fetching timeline:', error);
        return NextResponse.json({ error: 'Failed to fetch timeline' }, { status: 500 });
    }
}
