import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from 'crypto';

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

/**
 * Downloads media from a URL and uploads it to Cloudflare R2.
 * @param url The original media URL.
 * @param postId The ID of the post for folder organization.
 * @param referer Optional referer for bypassing hotlinking protection.
 * @returns The public R2 URL or null if upload fails.
 */
export async function uploadMediaToR2(url: string, postId: string, referer?: string): Promise<string | null> {
  console.log(`[R2 Trace] Starting upload for: ${url}`);
  if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_BUCKET_NAME) {
    console.warn("[R2 Trace] Missing configuration, skipping upload.");
    console.log(`  R2_ACCESS_KEY_ID: ${process.env.R2_ACCESS_KEY_ID ? 'SET' : 'MISSING'}`);
    console.log(`  R2_BUCKET_NAME: ${process.env.R2_BUCKET_NAME ? 'SET' : 'MISSING'}`);
    return null;
  }

  try {
    const lowerUrl = url.toLowerCase();
    const isXhs = lowerUrl.includes('xiaohongshu.com') || lowerUrl.includes('xhslink.com') || lowerUrl.includes('sns-webpic');
    const isTwitter = lowerUrl.includes('twimg.com') || lowerUrl.includes('twitter.com');

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    if (referer) {
      headers['Referer'] = referer;
    } else if (isXhs) {
      headers['Referer'] = 'https://www.xiaohongshu.com/';
      headers['User-Agent'] = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
    } else if (isTwitter) {
      headers['Referer'] = 'https://twitter.com/';
    }

    let response = await fetch(url, { headers });
    console.log(`[R2 Trace] Fetch status: ${response.status} ${response.statusText}`);

    // Fallback for Xiaohongshu 403: Retry without Referer
    if (!response.ok && response.status === 403 && isXhs) {
      console.log(`[R2 Trace] 403 Forbidden for XHS. Retrying without Referer...`);
      const fallbackHeaders = { ...headers };
      delete fallbackHeaders['Referer'];
      response = await fetch(url, { headers: fallbackHeaders });
      console.log(`[R2 Trace] Fallback fetch status: ${response.status} ${response.statusText}`);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch media: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    console.log(`[R2 Trace] Content-Type: ${contentType}, Size: ${buffer.length} bytes`);
    
    // Determine file extension
    let extension = "jpg";
    if (contentType.includes("video/mp4")) extension = "mp4";
    else if (contentType.includes("image/png")) extension = "png";
    else if (contentType.includes("image/gif")) extension = "gif";
    else if (contentType.includes("image/webp")) extension = "webp";
    else {
        const match = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
        if (match) extension = match[1];
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const fileName = `${year}/${month}/${postId}/${crypto.randomUUID()}.${extension}`;
    console.log(`[R2 Trace] Uploading to Key: ${fileName}`);

    await r2Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileName,
        Body: buffer,
        ContentType: contentType,
      })
    );

    const publicDomain = process.env.R2_PUBLIC_DOMAIN?.replace(/\/$/, "");
    const finalUrl = `${publicDomain}/${fileName}`;
    console.log(`[R2 Trace] SUCCESS! R2 URL: ${finalUrl}`);
    return finalUrl;
  } catch (error: any) {
    console.error(`[R2 Upload Error] URL: ${url}`);
    console.error(`  Error: ${error.message || error}`);
    if (error.stack) console.error(`  Stack: ${error.stack}`);
    return null;
  }
}
