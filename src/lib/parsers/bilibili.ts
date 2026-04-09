import { ContentParser, ParsedData } from './index';

export class BilibiliParser implements ContentParser {
  match(url: string): boolean {
    return url.includes('bilibili.com/video/BV');
  }

  async parse(url: string): Promise<ParsedData> {
    let bvid = '';
    const bvMatch = url.match(/(BV[a-zA-Z0-9]{10})/);
    if (bvMatch) {
      bvid = bvMatch[1];
    } else {
      throw new Error('Could not extract BV id from the Bilibili URL.');
    }

    const apiUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;

    const res = await fetch(apiUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    
    if (!res.ok) {
      throw new Error(`Failed to fetch Bilibili data: ${res.statusText}`);
    }

    const json = await res.json();
    if (json.code !== 0) {
      throw new Error(`Bilibili API error: ${json.message}`);
    }

    const data = json.data;
    
    return {
      platform: 'BILIBILI',
      authorName: data.owner?.name || 'Bilibili Uploader',
      avatarUrl: data.owner?.face || '',
      contentText: data.title + '\n\n' + (data.desc || ''),
      mediaUrls: data.pic ? [data.pic] : [],
    };
  }
}
