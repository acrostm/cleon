import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    if (!url) {
        return new NextResponse('Missing url parameter', { status: 400 });
    }

    try {
        const decodedUrl = decodeURIComponent(url);
        const lowerUrl = decodedUrl.toLowerCase();
        const isXhs = lowerUrl.includes('xiaohongshu.com') || lowerUrl.includes('xhslink.com') || lowerUrl.includes('sns-webpic');
        const isTwitter = lowerUrl.includes('twimg.com') || lowerUrl.includes('twitter.com');
        
        const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        };
        
        if (isXhs) {
            headers['Referer'] = 'https://www.xiaohongshu.com/';
        } else if (isTwitter) {
            headers['Referer'] = 'https://twitter.com/';
        } else {
            try {
                headers['Referer'] = new URL(decodedUrl).origin + '/';
            } catch {
                // Ignore invalid URLs
            }
        }

        const response = await fetch(decodedUrl, { headers });

        if (!response.ok) {
             return new NextResponse(`Failed to fetch media: ${response.status}`, { status: response.status });
        }

        const resHeaders = new Headers();
        resHeaders.set('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');
        resHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
        resHeaders.set('Access-Control-Allow-Origin', '*');

        return new NextResponse(response.body, { headers: resHeaders });
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
