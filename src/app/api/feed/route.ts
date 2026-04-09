import { NextResponse } from 'next/server';
import { getParserForUrl } from '@/lib/parsers';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const parser = getParserForUrl(url);
    const parsedData = await parser.parse(url);

    const post = await prisma.post.create({
      data: {
        originalUrl: url,
        platform: parsedData.platform,
        authorName: parsedData.authorName,
        avatarUrl: parsedData.avatarUrl,
        contentText: parsedData.contentText,
        mediaUrls: parsedData.mediaUrls || [],
      }
    });

    return NextResponse.json({ success: true, data: post }, { status: 201 });
  } catch (error: any) {
    console.error('Error parsing feed URL:', error);
    return NextResponse.json({ error: error.message || 'Failed to parse URL' }, { status: 500 });
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
