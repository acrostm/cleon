import * as cheerio from 'cheerio';
import { ContentParser, ParsedData } from './index';

export class YoutubeParser implements ContentParser {
  match(url: string): boolean {
    return /youtube\.com|youtu\.be/.test(url);
  }

  async parse(url: string): Promise<ParsedData> {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new Error(`Failed to extract video ID from YouTube URL: ${url}`);
    }

    // 1. Fetch oEmbed as a base for stable data
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    let oembedData: any = {};
    try {
        const res = await fetch(oembedUrl);
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
        const pageRes = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

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
                    const data = JSON.parse(initialDataMatch[1]);
                    
                    // Recursive search for specific keys
                    const findKey = (obj: any, key: string): any => {
                        if (obj !== null && typeof obj === 'object') {
                            if (obj[key]) return obj[key];
                            for (const k in obj) {
                                if (Object.prototype.hasOwnProperty.call(obj, k)) {
                                    const result = findKey(obj[k], key);
                                    if (result) return result;
                                }
                            }
                        }
                        return null;
                    };

                    // Extract avatar from videoOwnerRenderer
                    const owner = findKey(data, 'videoOwnerRenderer');
                    if (owner) {
                        const thumbnails = owner.thumbnail?.thumbnails;
                        if (thumbnails && thumbnails.length > 0) {
                            avatarUrl = thumbnails[thumbnails.length - 1].url;
                        }
                        if (!authorName || authorName === 'YouTube User') {
                            authorName = owner.title?.runs?.[0]?.text || authorName;
                        }
                    }

                    // Extract detailed description (often more complete than meta tags)
                    const secondaryInfo = findKey(data, 'videoSecondaryInfoRenderer');
                    if (secondaryInfo) {
                         if (secondaryInfo.attributedDescription?.content) {
                             description = secondaryInfo.attributedDescription.content;
                         } else if (secondaryInfo.description?.runs) {
                             description = secondaryInfo.description.runs.map((r: any) => r.text).join('');
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
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
  }
}
