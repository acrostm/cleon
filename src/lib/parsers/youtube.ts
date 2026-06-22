import * as cheerio from 'cheerio';
import { ContentParser, ParsedData } from './index';
import { fetchValidatedUrl } from '@/lib/utils/url';

type YoutubeOembed = {
  author_name?: string;
  title?: string;
};

type YoutubeThumbnail = {
  url?: string;
};

type YoutubeOwnerRenderer = {
  thumbnail?: {
    thumbnails?: YoutubeThumbnail[];
  };
  title?: {
    runs?: Array<{ text?: string }>;
  };
};

type YoutubeSecondaryInfoRenderer = {
  attributedDescription?: {
    content?: string;
  };
  description?: {
    runs?: Array<{ text?: string }>;
  };
};

const normalizeYoutubeVideoId = (value: string | null | undefined) =>
  value && /^[a-zA-Z0-9_-]{11}$/.test(value) ? value : null;

export class YoutubeParser implements ContentParser {
  match(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return (
        hostname === 'youtu.be' ||
        hostname === 'youtube.com' ||
        hostname === 'www.youtube.com' ||
        hostname === 'm.youtube.com'
      );
    } catch {
      return false;
    }
  }

  async parse(url: string): Promise<ParsedData> {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new Error(`Failed to extract video ID from YouTube URL: ${url}`);
    }

    // 1. Fetch oEmbed as a base for stable data
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    let oembedData: YoutubeOembed = {};
    try {
        const res = await fetchValidatedUrl(oembedUrl, {}, { timeoutMs: 10_000, maxBytes: 1_000_000 });
        if (res.ok) {
            oembedData = await res.json();
        }
    } catch (e) {
        console.error("YouTube oEmbed fetch failed", e);
    }

    // 2. Fetch original page for avatar and description
    let avatarUrl = 'https://www.google.com/s2/favicons?domain=youtube.com&sz=128';
    let description = '';
    let authorName = oembedData.author_name || 'YouTube User';
    let title = oembedData.title || 'YouTube Video';

    try {
        const pageRes = await fetchValidatedUrl(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        }, { timeoutMs: 12_000, maxBytes: 4_000_000 });

        if (pageRes.ok) {
            const html = await pageRes.text();
            const $ = cheerio.load(html);

            // Use meta tags as first-tier fallback for title/description
            if (!title || title === 'YouTube Video') {
                title = $('meta[name="title"]').attr('content') || $('meta[property="og:title"]').attr('content') || title;
            }
            description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';

            // Extract ytInitialData for avatar and full description
            const initialDataMatch = html.match(/var ytInitialData = (\{.*?\});/);
            if (initialDataMatch) {
                try {
                    const data = JSON.parse(initialDataMatch[1]) as unknown;
                    
                    // Recursive search for specific keys
                    const findKey = (obj: unknown, key: string): unknown => {
                        if (obj !== null && typeof obj === 'object') {
                            const record = obj as Record<string, unknown>;
                            if (record[key]) return record[key];
                            for (const k in record) {
                                if (Object.prototype.hasOwnProperty.call(record, k)) {
                                    const result = findKey(record[k], key);
                                    if (result) return result;
                                }
                            }
                        }
                        return null;
                    };

                    // Extract avatar from videoOwnerRenderer
                    const owner = findKey(data, 'videoOwnerRenderer') as YoutubeOwnerRenderer | null;
                    if (owner) {
                        const thumbnails = owner.thumbnail?.thumbnails;
                        if (thumbnails && thumbnails.length > 0) {
                            avatarUrl = thumbnails[thumbnails.length - 1].url || avatarUrl;
                        }
                        if (!authorName || authorName === 'YouTube User') {
                            authorName = owner.title?.runs?.[0]?.text || authorName;
                        }
                    }

                    // Extract detailed description (often more complete than meta tags)
                    const secondaryInfo = findKey(data, 'videoSecondaryInfoRenderer') as YoutubeSecondaryInfoRenderer | null;
                    if (secondaryInfo) {
                         if (secondaryInfo.attributedDescription?.content) {
                             description = secondaryInfo.attributedDescription.content;
                         } else if (secondaryInfo.description?.runs) {
                             description = secondaryInfo.description.runs.map((r) => r.text || '').join('');
                         }
                    }
                } catch (jsonError) {
                    console.error("Failed to parse ytInitialData", jsonError);
                }
            }
        }
    } catch (pageError) {
        console.error("YouTube page fetch failed", pageError);
    }

    // Construct robust player URL
    const playerUrl = `https://www.youtube.com/embed/${videoId}?feature=oembed`;
    
    return {
      platform: 'YOUTUBE',
      authorName,
      avatarUrl,
      title,
      contentText: description,
      mediaUrls: [playerUrl],
    };
  }

  private extractVideoId(url: string): string | null {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();

      if (hostname === 'youtu.be') {
        return normalizeYoutubeVideoId(parsed.pathname.split('/').filter(Boolean)[0]);
      }

      if (parsed.pathname === '/watch') {
        return normalizeYoutubeVideoId(parsed.searchParams.get('v'));
      }

      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts[0] === 'shorts' || pathParts[0] === 'embed' || pathParts[0] === 'v') {
        return normalizeYoutubeVideoId(pathParts[1]);
      }

      return null;
    } catch {
      return null;
    }
  }
}
