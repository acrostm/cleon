import * as cheerio from 'cheerio';
import { ContentParser, ParsedData } from './index';

export class JinshiParser implements ContentParser {
  match(url: string): boolean {
    return /jin10\.com/.test(url);
  }

  async parse(url: string): Promise<ParsedData> {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        }
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch Jinshi Data page: ${res.statusText}`);
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      // Detail page usually has these classes
      let title = $('.detail-title').text().trim();
      let contentText = $('.detail-content').text().trim();

      // If text is not found, try to look for Nuxt/Next state or general content containers
      if (!contentText) {
          contentText = $('.jin-flash-item-container .content').text().trim();
      }
      
      if (!title) {
          title = $('.jin-flash-item-container .title').text().trim() || 'Jinshi Flash';
      }

      // If still empty, it might be an SSR page with JSON in a script tag
      if (!contentText) {
          const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});?<\/script>/);
          if (stateMatch) {
              try {
                  const state = JSON.parse(stateMatch[1]);
                  // Adjust based on actual Jin10 state structure if discovered
                  const newsDetail = state.newsDetail || state.flashDetail;
                  if (newsDetail) {
                      title = newsDetail.title || title;
                      contentText = newsDetail.content || contentText;
                  }
              } catch (e) {
                  console.error("Failed to parse Jinshi INITIAL_STATE:", e);
              }
          }
      }

      // Final fallback if we have absolutely nothing
      if (!contentText) {
          // Sometimes the whole news content is in the title for flash news
          contentText = title;
      }

      return {
        platform: 'JINSHI' as any,
        authorName: '金十数据',
        avatarUrl: 'https://www.jin10.com/favicon.ico',
        title: title || '金十快讯',
        contentText: contentText,
        mediaUrls: [],
      };
    } catch (error) {
      console.error("[Jinshi Parser Error]:", error);
      throw new Error("Jinshi Data scraping failed. The link may be invalid or the content is protected.");
    }
  }
}
