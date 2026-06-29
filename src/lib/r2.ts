import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import crypto from 'crypto';
import { fetchValidatedUrl, isSafeDataImageUrl, redactUrlForLog, validateUrl } from '@/lib/utils/url';

const MAX_R2_MEDIA_BYTES = 50 * 1024 * 1024;
const MAX_ARCHIVE_IMAGE_BYTES = 20 * 1024 * 1024;
const ARCHIVE_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ArchiveMediaUploadResult = {
  storageUrl: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
};

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

function getR2PublicDomain() {
  return (process.env.R2_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN)?.replace(/\/$/, "");
}

function getImageExtension(contentType: string, sourceUrl?: string) {
  if (contentType.includes("image/png")) return "png";
  if (contentType.includes("image/webp")) return "webp";
  if (contentType.includes("image/jpeg") || contentType.includes("image/jpg")) return "jpg";

  if (sourceUrl) {
    const match = sourceUrl.match(/\.([a-zA-Z0-9]+)(\?|$)/);
    if (match && ["jpg", "jpeg", "png", "webp"].includes(match[1].toLowerCase())) {
      return match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
    }
  }

  return "jpg";
}

/**
 * Deletes a media file from Cloudflare R2.
 * @param url The public R2 URL of the media.
 * @returns True if deletion was successful, false otherwise.
 */
export async function deleteMediaFromR2(url: string): Promise<boolean> {
  const publicDomain = getR2PublicDomain();
  
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

export async function uploadArchiveMediaToR2({
  url,
  accountId,
  postId,
  assetType,
  index,
  referer,
}: {
  url: string;
  accountId?: string | null;
  postId: string;
  assetType: "cover" | "image";
  index: number;
  referer?: string;
}): Promise<ArchiveMediaUploadResult | null> {
  console.log(`[R2 Archive Trace] Starting upload for: ${redactUrlForLog(url)}`);

  if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_BUCKET_NAME) {
    console.warn("[R2 Archive Trace] Missing configuration, skipping upload.");
    return null;
  }

  if (!validateUrl(url)) {
    console.warn("[R2 Archive Trace] Unsafe archive media URL skipped:", redactUrlForLog(url));
    return null;
  }

  try {
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
      Accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8",
    };

    if (referer) {
      headers.Referer = referer;
    } else {
      headers.Referer = "https://www.xiaohongshu.com/";
    }

    let response = await fetchValidatedUrl(url, { headers }, { timeoutMs: 30_000, maxBytes: MAX_ARCHIVE_IMAGE_BYTES });

    if (!response.ok && response.status === 403) {
      const fallbackHeaders = { ...headers };
      delete fallbackHeaders.Referer;
      response = await fetchValidatedUrl(url, { headers: fallbackHeaders }, { timeoutMs: 30_000, maxBytes: MAX_ARCHIVE_IMAGE_BYTES });
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch archive media: ${response.status} ${response.statusText}`);
    }

    const contentType = (response.headers.get("content-type") || "application/octet-stream").split(";")[0].trim().toLowerCase();
    if (!ARCHIVE_IMAGE_MIME_TYPES.has(contentType)) {
      throw new Error(`Unsupported archive image type: ${contentType}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_ARCHIVE_IMAGE_BYTES) {
      throw new Error("Archive image is too large");
    }

    const buffer = Buffer.from(arrayBuffer);
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    const extension = getImageExtension(contentType, url);
    const fileIndex = String(Math.max(index, 1)).padStart(3, "0");
    const safeAccountId = accountId || "manual";
    const fileName = assetType === "cover" ? `cover.${extension}` : `image_${fileIndex}.${extension}`;
    const key = `xhs-archive/account_${safeAccountId}/post_${postId}/${fileName}`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    const publicDomain = getR2PublicDomain();
    if (!publicDomain) {
      throw new Error("Missing R2 public domain for archive upload URL");
    }

    return {
      storageUrl: `${publicDomain}/${key}`,
      sha256,
      sizeBytes: buffer.length,
      mimeType: contentType,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[R2 Archive Upload Error] URL: ${redactUrlForLog(url)}`);
    console.error(`  Error: ${errorMessage}`);
    return null;
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
  console.log(`[R2 Trace] Starting upload for: ${url.startsWith('data:') ? 'base64 image' : redactUrlForLog(url)}`);
  if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_BUCKET_NAME) {
    console.warn("[R2 Trace] Missing configuration, skipping upload.");
    return null;
  }

  try {
    let buffer: Buffer;
    let contentType: string;
    let extension = "jpg";

    if (url.startsWith('data:')) {
      if (!isSafeDataImageUrl(url, MAX_R2_MEDIA_BYTES)) {
        throw new Error("Invalid or oversized base64 data image");
      }

      const match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) throw new Error("Invalid base64 data URL");
      contentType = match[1].toLowerCase();
      buffer = Buffer.from(match[2], 'base64');
      
      if (contentType.includes("image/png")) extension = "png";
      else if (contentType.includes("image/gif")) extension = "gif";
      else if (contentType.includes("image/webp")) extension = "webp";
    } else {
      if (!validateUrl(url)) {
        throw new Error("Invalid or unsafe media URL");
      }

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

      let response = await fetchValidatedUrl(url, { headers }, { timeoutMs: 15_000, maxBytes: MAX_R2_MEDIA_BYTES });
      console.log(`[R2 Trace] Fetch status: ${response.status} ${response.statusText}`);

      // Fallback for Xiaohongshu 403: Retry without Referer
      if (!response.ok && response.status === 403 && isXhs) {
        console.log(`[R2 Trace] 403 Forbidden for XHS. Retrying without Referer...`);
        const fallbackHeaders = { ...headers };
        delete fallbackHeaders['Referer'];
        response = await fetchValidatedUrl(url, { headers: fallbackHeaders }, { timeoutMs: 15_000, maxBytes: MAX_R2_MEDIA_BYTES });
        console.log(`[R2 Trace] Fallback fetch status: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch media: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_R2_MEDIA_BYTES) {
        throw new Error("Remote media is too large");
      }

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

    const publicDomain = getR2PublicDomain();
    const finalUrl = `${publicDomain}/${fileName}`;
    console.log(`[R2 Trace] SUCCESS! R2 URL: ${finalUrl}`);
    return finalUrl;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[R2 Upload Error] URL: ${url.startsWith('data:') ? 'base64 image' : redactUrlForLog(url)}`);
    console.error(`  Error: ${errorMessage}`);
    return null;
  }
}
