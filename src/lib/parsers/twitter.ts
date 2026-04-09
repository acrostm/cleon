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
    
    return {
      platform: 'TWITTER',
      authorName: data.user_name || data.user_screen_name || 'X User',
      avatarUrl: data.user_profile_image_url || '',
      contentText: data.text || '',
      mediaUrls: data.mediaURLs || data.media_extended?.map((m: any) => m.url) || [],
    };
  }
}
