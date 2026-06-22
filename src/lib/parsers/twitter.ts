import { ContentParser, ParsedData } from './index';
import { fetchValidatedUrl } from '@/lib/utils/url';

type TwitterMedia = {
  url?: string;
};

type TwitterPayload = {
  mediaURLs?: string[];
  media_extended?: TwitterMedia[];
  article?: {
    title?: string;
    preview_text?: string;
    image?: string;
  };
  text?: string;
  user_name?: string;
  user_screen_name?: string;
  user_profile_image_url?: string;
};

export class TwitterParser implements ContentParser {
  match(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return hostname === 'twitter.com' || hostname === 'x.com' || hostname === 'www.twitter.com' || hostname === 'www.x.com' || hostname === 'mobile.twitter.com' || hostname === 'mobile.x.com';
    } catch {
      return false;
    }
  }

  async parse(url: string): Promise<ParsedData> {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const apiUrl = `https://api.vxtwitter.com${path}`;

    const res = await fetchValidatedUrl(apiUrl, {}, { timeoutMs: 10_000, maxBytes: 1_000_000 });
    if (!res.ok) {
      throw new Error(`Failed to fetch X/Twitter data: ${res.statusText}`);
    }

    const data = await res.json() as TwitterPayload;
    
    let title = '';
    let body = '';
    const mediaUrls: string[] = data.mediaURLs || data.media_extended?.map((m) => m.url || '').filter(Boolean) || [];

    // Handle Twitter Articles
    if (data.article) {
        title = data.article.title || '';
        body = (data.article.preview_text || '') + '\n\n(View Full Article at Source)';
        if (data.article.image && !mediaUrls.includes(data.article.image)) {
            mediaUrls.unshift(data.article.image);
        }
    } else {
        const fullText = data.text || '';
        const textSegments = fullText.trim().split(/\n+/);
        if (textSegments.length > 1) {
            title = textSegments[0];
            body = textSegments.slice(1).join('\n');
        } else {
            const sentences = fullText.split(/(?<=[。！？.!?])/);
            if (sentences.length > 1 && sentences[0].length < 100) {
                title = sentences[0];
                body = sentences.slice(1).join('').trim();
            } else {
                title = fullText;
                body = '';
            }
        }
    }

    return {
      platform: 'TWITTER',
      authorName: data.user_name || data.user_screen_name || 'X User',
      avatarUrl: data.user_profile_image_url || '',
      title: title,
      contentText: body,
      mediaUrls: mediaUrls,
    };
  }
}
