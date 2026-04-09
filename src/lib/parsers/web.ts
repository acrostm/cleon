import * as cheerio from 'cheerio';
import { ContentParser, ParsedData } from './index';

export class WebParser implements ContentParser {
  match(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  async parse(url: string): Promise<ParsedData> {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch web page: ${res.statusText}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $('title').text() || $('meta[property="og:title"]').attr('content') || '';
    const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
    const image = $('meta[property="og:image"]').attr('content') || '';
    const author = $('meta[name="author"]').attr('content') || $('meta[property="article:author"]').attr('content') || new URL(url).hostname;

    return {
      platform: 'WEB',
      authorName: author,
      avatarUrl: '',
      contentText: title + (description ? '\n\n' + description : ''),
      mediaUrls: image ? [image] : [],
    };
  }
}
