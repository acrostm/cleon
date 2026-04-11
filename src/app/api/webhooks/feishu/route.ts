import { NextResponse, after } from 'next/server';
import { getParserForUrl } from '@/lib/parsers';
import { extractUrl, validateUrl } from '@/lib/utils/url';
import prisma from '@/lib/prisma';
import jsQR from 'jsqr';
import { Jimp } from 'jimp';

// In-memory cache to quickly discard duplicate events (e.g. from Feishu webhook retries)
// This works per-instance; combined with 'after()', it virtually eliminates duplicate processing.
const processedMessageIds = new Set<string>();

// Helper to fetch Feishu tenant access token
async function getTenantAccessToken() {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appId || !appSecret) {
    console.error('Missing FEISHU_APP_ID or FEISHU_APP_SECRET');
    return null;
  }

  try {
    const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
    });

    const data = await res.json();
    if (data.code === 0) {
      return data.tenant_access_token;
    } else {
      console.error('Failed to get tenant access token:', data);
      return null;
    }
  } catch (error) {
    console.error('Error fetching tenant access token:', error);
    return null;
  }
}

// Helper to fetch and scan QR code from image
async function extractUrlFromImage(messageId: string, imageKey: string): Promise<string | null> {
  const token = await getTenantAccessToken();
  if (!token) return null;

  try {
    const res = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/resources/${imageKey}?type=image`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      console.error('Failed to fetch image from Feishu:', res.statusText);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Read image using Jimp
    const image = await Jimp.read(buffer);
    const { data, width, height } = image.bitmap;
    
    // Scan for QR code
    const code = jsQR(new Uint8ClampedArray(data), width, height);
    return code ? code.data : null;
  } catch (error) {
    console.error('Error scanning QR code from Feishu image:', error);
    return null;
  }
}

// Helper to send reply to Feishu Bot message
async function replyToMessage(messageId: string, text: string) {
  const token = await getTenantAccessToken();
  if (!token) return;

  try {
    const res = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reply`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        content: JSON.stringify({ text }),
        msg_type: 'text',
      }),
    });

    const data = await res.json();
    if (data.code !== 0) {
      console.error('Failed to reply to Feishu message:', data);
    }
  } catch (error) {
    console.error('Error replying to Feishu message:', error);
  }
}

export async function POST(req: Request) {
  try {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${protocol}://${host}`;

    const body = await req.json();

    // 1. URL Verification Challenge
    if (body.type === 'url_verification') {
      if (body.token !== process.env.FEISHU_VERIFICATION_TOKEN) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
      }
      return NextResponse.json({ challenge: body.challenge });
    }

    // 2. Event Payload Handling
    if (body.header?.event_type === 'im.message.receive_v1') {
      if (body.header.token !== process.env.FEISHU_VERIFICATION_TOKEN) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
      }

      const event = body.event;
      const message = event.message;

      // Handle both text and image messages
      let rawUrl: string | null = null;

      if (message.message_type === 'text') {
        try {
          const contentObj = JSON.parse(message.content);
          rawUrl = extractUrl(contentObj.text);
        } catch {
          console.error('Failed to parse text message content:', message.content);
        }
      } else if (message.message_type === 'image') {
        try {
          const contentObj = JSON.parse(message.content);
          const imageKey = contentObj.image_key;
          if (imageKey) {
            // Need to await here to check if it's a valid URL before proceeding to background
            rawUrl = await extractUrlFromImage(message.message_id, imageKey);
          }
        } catch (err) {
          console.error('Failed to process image message:', err);
        }
      }

      if (rawUrl) {
        if (!validateUrl(rawUrl)) {
          console.warn('Blocked potentially unsafe or invalid URL:', rawUrl);
          await replyToMessage(message.message_id, "⚠️ Rejected: The extracted URL is invalid or unsafe.");
          return NextResponse.json({ success: true });
        }

        if (processedMessageIds.has(message.message_id)) {
          console.log('Skipping already processed message_id:', message.message_id);
          return NextResponse.json({ success: true });
        }

        processedMessageIds.add(message.message_id);
        if (processedMessageIds.size > 1000) {
          const iterator = processedMessageIds.values();
          for (let i = 0; i < 500; i++) {
            processedMessageIds.delete(iterator.next().value!);
          }
        }

        after(async () => {
          try {
            const parser = getParserForUrl(rawUrl!);
            const parsedData = await parser.parse(rawUrl!);

            const recentDuplicate = await prisma.post.findFirst({
              where: {
                originalUrl: rawUrl!,
                createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }
              }
            });

            if (recentDuplicate) {
              const shareUrl = `${baseUrl}/#${recentDuplicate.id}`;
              await replyToMessage(message.message_id, shareUrl);
              return;
            }

            const post = await prisma.post.create({
              data: {
                originalUrl: rawUrl!,
                platform: parsedData.platform,
                authorName: parsedData.authorName,
                avatarUrl: parsedData.avatarUrl,
                title: parsedData.title,
                contentText: parsedData.contentText,
                mediaUrls: parsedData.mediaUrls || [],
              }
            });

            const shareUrl = `${baseUrl}/#${post.id}`;
            await replyToMessage(message.message_id, shareUrl);
          } catch (parseError: unknown) {
            console.error('Error parsing/saving content from Feishu bot:', parseError);
            const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error';
            await replyToMessage(message.message_id, `Failed to save: ${errorMessage}`);
          }
        });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
