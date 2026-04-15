import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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
 * Deletes a media file from Cloudflare R2.
 * @param url The public R2 URL of the media.
 * @returns True if deletion was successful, false otherwise.
 */
export async function deleteMediaFromR2(url: string): Promise<boolean> {
  const publicDomain = (process.env.R2_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN)?.replace(/\/$/, "");
  
  if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_BUCKET_NAME) {
    console.warn("[R2 Trace] Missing configuration for deletion.");
    return false;
  }

  // If it doesn't have the public domain, it's not an R2 URL (e.g. embed or original source)
  if (!publicDomain || !url.startsWith(publicDomain)) {
    return true; 
  }

  try {
    const key = url.substring(publicDomain.length + 1); // +1 to remove the leading slash
    console.log(`[R2 Trace] Deleting Key: ${key}`);

    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      })
    );
    console.log(`[R2 Trace] SUCCESS! Deleted R2 URL: ${url}`);
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[R2 Delete Error] URL: ${url}`);
    console.error(`  Error: ${errorMessage}`);
    return false;
  }
}

/**
 * Downloads media from a URL and uploads it to Cloudflare R2.
 * @param url The original media URL.
 * @param postId The ID of the post for folder organization.
 * @param referer Optional referer for bypassing hotlinking protection.
 * @returns The public R2 URL or null if upload fails.
 */
export async function uploadMediaToR2(url: string, postId: string, referer?: string): Promise<string | null> {
  console.log(`[R2 Trace] Starting upload for: ${url.startsWith('data:') ? 'base64 image' : url}`);
  if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_BUCKET_NAME) {
    console.warn("[R2 Trace] Missing configuration, skipping upload.");
    return null;
  }

  try {
    let buffer: Buffer;
    let contentType: string;
    let extension = "jpg";

    if (url.startsWith('data:')) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) throw new Error("Invalid base64 data URL");
      contentType = match[1];
      buffer = Buffer.from(match[2], 'base64');
      
      if (contentType.includes("image/png")) extension = "png";
      else if (contentType.includes("image/gif")) extension = "gif";
      else if (contentType.includes("image/webp")) extension = "webp";
    } else {
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
      buffer = Buffer.from(arrayBuffer);
      contentType = response.headers.get("content-type") || "application/octet-stream";
      
      if (contentType.includes("video/mp4")) extension = "mp4";
      else if (contentType.includes("image/png")) extension = "png";
      else if (contentType.includes("image/gif")) extension = "gif";
      else if (contentType.includes("image/webp")) extension = "webp";
      else {
          const match = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
          if (match) extension = match[1];
      }
    }

    console.log(`[R2 Trace] Content-Type: ${contentType}, Size: ${buffer.length} bytes`);
    
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

    const publicDomain = (process.env.R2_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN)?.replace(/\/$/, "");
    const finalUrl = `${publicDomain}/${fileName}`;
    console.log(`[R2 Trace] SUCCESS! R2 URL: ${finalUrl}`);
    return finalUrl;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[R2 Upload Error] URL: ${url.startsWith('data:') ? 'base64 image' : url}`);
    console.error(`  Error: ${errorMessage}`);
    return null;
  }
}


