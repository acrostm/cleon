import { NextResponse } from 'next/server';
import { getParserForUrl } from '@/lib/parsers';
import { extractUrl } from '@/lib/utils/url';
import prisma from '@/lib/prisma';

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
        } catch (e) {
          console.error('Failed to parse message content:', message.content);
        }

        if (textContent) {
          // Extract the first valid URL from the message text
          const rawUrl = extractUrl(textContent);
          
          if (!rawUrl) {
            // Optional: You could notify the user that no URL was found
            // await replyToMessage(message.message_id, "No valid URL found in the message.");
            return NextResponse.json({ success: true });
          }

          try {
            // Get appropriate parser and parse the content (e.g., Twitter, Bilibili)
            const parser = getParserForUrl(rawUrl);
            const parsedData = await parser.parse(rawUrl);

            // Save the extracted post data to the database
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

            // Reply back to the user upon success
            await replyToMessage(message.message_id, "Saved to timeline!");
          } catch (parseError: unknown) {
            console.error('Error parsing/saving URL from Feishu bot:', parseError);
            const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error';
            await replyToMessage(message.message_id, `Failed to save: ${errorMessage}`);
          }
        }
      }

      // Return 200 OK for successful event processing
      return NextResponse.json({ success: true });
    }

    // Return 200 OK for unhandled event types so Feishu doesn't retry
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
