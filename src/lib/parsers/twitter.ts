import { ContentParser, ParsedData } from './index';

export class TwitterParser implements ContentParser {
  match(url: string): boolean {
    const parsed = new URL(url);
    return parsed.hostname === 'twitter.com' || parsed.hostname === 'x.com' || parsed.hostname === 'www.twitter.com' || parsed.hostname === 'www.x.com';
  }

  async parse(url: string): Promise<ParsedData> {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const apiUrl = `https://api.vxtwitter.com${path}`;

    const res = await fetch(apiUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch X/Twitter data: ${res.statusText}`);
    }

    const data = await res.json();
    
    const fullText = data.text || '';
    let title = '';
    let body = fullText;

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

    return {
      platform: 'TWITTER',
      authorName: data.user_name || data.user_screen_name || 'X User',
      avatarUrl: data.user_profile_image_url || '',
      title: title,
      contentText: body,
      mediaUrls: data.mediaURLs || data.media_extended?.map((m: any) => m.url) || [],
    };
  }
}
