import { ContentParser, ParsedData } from './index';

export class BilibiliParser implements ContentParser {
  match(url: string): boolean {
    return /bilibili\.com|b23\.tv/.test(url);
  }

  async parse(url: string): Promise<ParsedData> {
    let bvid = '';
    let targetUrl = url;

    // Follow redirect if it's a shortlink without a BV id
    if (!targetUrl.includes('BV')) {
       try {
           const redirectRes = await fetch(url, {
               method: 'HEAD',
               headers: {
                   'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
               }
           });
           targetUrl = redirectRes.url;
       } catch (error) {
           console.log("Failed to resolve Bilibili shortlink", error);
       }
    }

    const bvMatch = targetUrl.match(/(BV[a-zA-Z0-9]{10})/);
    if (bvMatch) {
      bvid = bvMatch[1];
    } else {
      // In extremely rare cases where a Bilibili link is an article or something else, 
      // we could fallback to the web parser logic, but for now we expect video links.
      throw new Error('Could not extract BV id from the Bilibili URL.');
    }

    const apiUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;

    const res = await fetch(apiUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    
    if (!res.ok) {
      throw new Error(`Failed to fetch Bilibili API data: ${res.statusText}`);
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
