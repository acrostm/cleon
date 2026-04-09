import { NextResponse } from 'next/server';
import { getParserForUrl } from '@/lib/parsers';
import { extractUrl, validateUrl } from '@/lib/utils/url';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawUrl = body.url;

    if (!rawUrl) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const trimmedRawUrl = rawUrl.trim();
    const url = extractUrl(trimmedRawUrl) || trimmedRawUrl; // fallback to trimmed raw string if regex fails

    if (!validateUrl(url)) {
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

    return NextResponse.json({ success: true, data: post }, { status: 201 });
  } catch (error: any) {
    console.error('------- [API CRASH] Error parsing feed URL -------');
    console.error(error);
    return NextResponse.json({ 
      error: error.message || 'Failed to parse URL',
      details: process.env.NODE_ENV !== 'production' ? error.stack : undefined 
    }, { status: 500 });
  }
}

export async function GET() {
    try {
        const posts = await prisma.post.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, data: posts });
    } catch (error: any) {
        console.error('Error fetching timeline:', error);
        return NextResponse.json({ error: 'Failed to fetch timeline' }, { status: 500 });
    }
}
