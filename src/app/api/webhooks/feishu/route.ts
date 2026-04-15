import { NextResponse, after } from 'next/server';
import { getParserForUrl } from '@/lib/parsers';
import { extractUrl, validateUrl, normalizeUrl } from '@/lib/utils/url';
import prisma from '@/lib/prisma';
import jsQR from 'jsqr';
import { Jimp } from 'jimp';
import { uploadMediaToR2 } from '@/lib/r2';
import { isEmbedUrl } from '@/lib/utils';
import crypto from 'crypto';

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
async function extractUrlFromImage(messageId: string, imageKey: string): Promise<{ url: string | null, base64Image: string | null }> {
  const token = await getTenantAccessToken();
  if (!token) return { url: null, base64Image: null };

  try {
    const res = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/resources/${imageKey}?type=image`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      console.error('Failed to fetch image from Feishu:', res.statusText);
      return { url: null, base64Image: null };
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const base64Image = `data:${contentType};base64,${buffer.toString('base64')}`;

    // Read image using Jimp
    const image = await Jimp.read(buffer);
    const { data, width, height } = image.bitmap;
    
    // Scan for QR code
    const code = jsQR(new Uint8ClampedArray(data), width, height);
    return { url: code ? code.data : null, base64Image };
  } catch (error) {
    console.error('Error scanning QR code from Feishu image:', error);
    return { url: null, base64Image: null };
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

      // Filter for message types we handle
      if (message.message_type !== 'text' && message.message_type !== 'image') {
        return NextResponse.json({ success: true });
      }

      // 1. Immediate duplicate check to prevent processing retries
      if (processedMessageIds.has(message.message_id)) {
        return NextResponse.json({ success: true });
      }
      processedMessageIds.add(message.message_id);

      // Keep the cache limited
      if (processedMessageIds.size > 1000) {
        const iterator = processedMessageIds.values();
        for (let i = 0; i < 500; i++) {
          processedMessageIds.delete(iterator.next().value!);
        }
      }

      // 2. Background processing
      after(async () => {
        let rawUrl: string | null = null;
        let sharedBase64Image: string | null = null;

        try {
          if (message.message_type === 'text') {
            const contentObj = JSON.parse(message.content);
            rawUrl = extractUrl(contentObj.text);
          } else if (message.message_type === 'image') {
            const contentObj = JSON.parse(message.content);
            const imageKey = contentObj.image_key;
            if (imageKey) {
              const result = await extractUrlFromImage(message.message_id, imageKey);
              rawUrl = result.url ? normalizeUrl(result.url) : null;
              sharedBase64Image = result.base64Image;
            }
          }

          if (!rawUrl) {
            if (message.message_type === 'image') {
              await replyToMessage(message.message_id, "🔍 未在图片中检测到二维码。请确保图片包含金十数据的分享二维码。");
            }
            return;
          }

          if (!validateUrl(rawUrl)) {
            await prisma.urlSubmission.create({
              data: { url: rawUrl, source: 'FEISHU', status: 'REJECTED', errorMessage: 'Invalid or unsafe URL' }
            });
            await replyToMessage(message.message_id, `⚠️ 拒绝：提取到的 URL 无效或不安全。\nURL: ${rawUrl}`);
            return;
          }

          // Proceed with parsing
          const parser = getParserForUrl(rawUrl);
          const parsedData = await parser.parse(rawUrl);

          const recentDuplicate = await prisma.post.findFirst({
            where: {
              originalUrl: rawUrl,
              createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }
            }
          });

          if (recentDuplicate) {
            await prisma.urlSubmission.create({
              data: { url: rawUrl, source: 'FEISHU', status: 'DUPLICATE', postId: recentDuplicate.id }
            });
            const shareUrl = `${baseUrl}/#${recentDuplicate.id}`;
            await replyToMessage(message.message_id, `✨ 已存在：${shareUrl}\n原文: ${rawUrl}`);
            return;
          }

          // For Jinshi or any scanned image, add it to the media pool
          if (sharedBase64Image) {
            if (parsedData.platform === 'JINSHI') {
              // For Jinshi, the user specifically wants the export image as the media_url
              parsedData.mediaUrls = [sharedBase64Image];
            } else {
              parsedData.mediaUrls = [sharedBase64Image, ...(parsedData.mediaUrls || [])];
            }
          }

          const postId = crypto.randomUUID();
          const originalMediaUrls = parsedData.mediaUrls || [];
          const mediaUrls: string[] = [];

          // Persist media to Cloudflare R2 if it's not an embed (like Bilibili/YT)
          for (const mediaUrl of originalMediaUrls) {
              if (isEmbedUrl(mediaUrl)) {
                  mediaUrls.push(mediaUrl);
                  continue;
              }

              // uploadMediaToR2 now handles base64 data URLs
              const r2Url = await uploadMediaToR2(mediaUrl, postId, rawUrl);
              if (r2Url) {
                  mediaUrls.push(r2Url);
              } else if (!mediaUrl.startsWith('data:')) {
                  // Fallback for non-base64 URLs if upload fails
                  mediaUrls.push(mediaUrl);
              }
          }


          const post = await prisma.post.create({
            data: {
              id: postId,
              originalUrl: rawUrl,
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
            data: { url: rawUrl, source: 'FEISHU', status: 'SUCCESS', postId: post.id }
          });

          const shareUrl = `${baseUrl}/#${post.id}`;
          await replyToMessage(message.message_id, `✅ 已成功采集！\n预览：${shareUrl}\n解析地址：${rawUrl}`);

        } catch (error: any) {
          console.error('Background processing error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await prisma.urlSubmission.create({
            data: { url: rawUrl || 'unknown', source: 'FEISHU', status: 'FAILED', errorMessage }
          });
          await replyToMessage(message.message_id, `❌ 处理失败：${errorMessage}${rawUrl ? `\n地址: ${rawUrl}` : ''}`);
        }
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
