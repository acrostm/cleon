import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { getParserForUrl } from '@/lib/parsers';
import { extractUrl, validateUrl } from '@/lib/utils/url';
import prisma from '@/lib/prisma';

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
    const body = await req.json();

    // 1. URL Verification Challenge
    // Required when setting up Event Subscriptions in Feishu Developer Console
    if (body.type === 'url_verification') {
      if (body.token !== process.env.FEISHU_VERIFICATION_TOKEN) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
      }
      return NextResponse.json({ challenge: body.challenge });
    }

    // 2. Event Payload Handling
    // Feishu events are wrapped in 'header' and 'event'
    if (body.header?.event_type === 'im.message.receive_v1') {
      // Verify token for security
      if (body.header.token !== process.env.FEISHU_VERIFICATION_TOKEN) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
      }

      const event = body.event;
      const message = event.message;

      // Only process text messages
      if (message.message_type === 'text') {
        let textContent = '';
        try {
          // Feishu message content is often a stringified JSON
          const contentObj = JSON.parse(message.content);
          textContent = contentObj.text;
        } catch {
          console.error('Failed to parse message content:', message.content);
        }

        if (textContent) {
          // Extract the first valid URL from the message text
          const rawUrl = extractUrl(textContent);

          if (!rawUrl) {
            return NextResponse.json({ success: true });
          }

          if (!validateUrl(rawUrl)) {
            console.warn('Blocked potentially unsafe or invalid URL:', rawUrl);
            await replyToMessage(message.message_id, "⚠️ Rejected: The provided URL is invalid or unsafe.");
            return NextResponse.json({ success: true });
          }

          // If we've already seen this message ID, it's a Feishu retry
          if (processedMessageIds.has(message.message_id)) {
            console.log('Skipping already processed message_id:', message.message_id);
            return NextResponse.json({ success: true });
          }

          processedMessageIds.add(message.message_id);
          // Keep the cache from growing indefinitely
          if (processedMessageIds.size > 1000) {
            const iterator = processedMessageIds.values();
            for (let i = 0; i < 500; i++) {
              processedMessageIds.delete(iterator.next().value!);
            }
          }

          // Process the URL in the background using `after`. 
          // This allows the webhook to immediately return 200 OK to Feishu,
          // preventing the 3-second timeout and stopping further retries.
          after(async () => {
            try {
              // 1. Get appropriate parser and parse the content (e.g., Twitter, Bilibili)
              const parser = getParserForUrl(rawUrl);
              const parsedData = await parser.parse(rawUrl);

              // 2. Secondary DB check to prevent duplicates across different serverless instances
              // If a post with the same original URL was added recently (within 5 minutes), skip it.
              const recentDuplicate = await prisma.post.findFirst({
                where: {
                  originalUrl: rawUrl,
                  createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }
                }
              });

              if (recentDuplicate) {
                console.log('Skipping database save, recent duplicate found for URL:', rawUrl);
                return;
              }

              // 3. Save the extracted post data to the database
              await prisma.post.create({
                data: {
                  originalUrl: rawUrl,
                  platform: parsedData.platform,
                  authorName: parsedData.authorName,
                  avatarUrl: parsedData.avatarUrl,
                  title: parsedData.title,
                  contentText: parsedData.contentText,
                  mediaUrls: parsedData.mediaUrls || [],
                }
              });

              // 4. Reply back to the user upon success
              await replyToMessage(message.message_id, "Saved to timeline!");
            } catch (parseError: unknown) {
              console.error('Error parsing/saving URL from Feishu bot:', parseError);
              const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error';
              await replyToMessage(message.message_id, `Failed to save: ${errorMessage}`);
            }
          });
        }
      }

      // Return 200 OK immediately so Feishu doesn't retry
      return NextResponse.json({ success: true });
    }

    // Return 200 OK for unhandled event types so Feishu doesn't retry
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
