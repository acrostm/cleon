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

      // 1. Try extraction from INITIAL_STATE if it exists (for SSR pages)
      let title = '';
      let contentText = '';
      const mediaUrls: string[] = [];
      
      const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});?<\/script>/);
      if (stateMatch) {
          try {
              const state = JSON.parse(stateMatch[1]);
              const article = state.newsDetail || state.flashDetail || state.articleDetail?.data;
              if (article) {
                  title = article.title || article.remark || '';
                  contentText = article.content ? cheerio.load(article.content).text() : (article.description || '');
                  
                  // Extract images from content
                  if (article.content) {
                      const content$ = cheerio.load(article.content);
                      content$('img').each((_, img) => {
                          const src = $(img).attr('src');
                          if (src) mediaUrls.push(src);
                      });
                  }
              }
          } catch (e) {
              console.error("Failed to parse Jinshi INITIAL_STATE:", e);
          }
      }

      // 2. Fallback to specific Jinshi detail page selectors
      if (!title) {
        title = $('.detail-title').text().trim() || 
                $('.jin-flash-item-container .title').text().trim() ||
                $('.news-detail-title').text().trim();
      }

      if (!contentText) {
        contentText = $('.detail-content').text().trim() || 
                      $('.J_flash_text').text().trim() || 
                      $('.flash-text').text().trim() || 
                      $('.jin-flash-item-container .content').text().trim() ||
                      $('.news-detail-content').text().trim();
      }

      // 3. Robust Meta tags (very reliable for social sharing/SEO)
      if (!title) {
          title = $('meta[property="og:title"]').attr('content') || 
                  $('meta[name="twitter:title"]').attr('content') ||
                  $('h1').first().text().trim() ||
                  $('title').text().replace('-金十数据', '').trim();
      }

      if (!contentText || contentText === title) {
          contentText = $('meta[property="og:description"]').attr('content') || 
                        $('meta[name="description"]').attr('content') || 
                        contentText;
      }

      // 4. Final Generic HTML Fallback
      if (!contentText || contentText.length < 5) {
          const paragraphs: string[] = [];
          $('p').each((_, el) => {
              const text = $(el).text().trim();
              // Jinshi often has very short sentences, let's be more lenient
              if (text.length > 5) paragraphs.push(text);
          });
          if (paragraphs.length > 0) {
             contentText = paragraphs.join('\n\n');
          }
      }

      // 5. Image extraction from HTML
      if (mediaUrls.length === 0) {
          $('.detail-content img, .flash-item img, .news-detail-content img').each((_, img) => {
              const src = $(img).attr('src');
              if (src && !src.includes('favicon')) mediaUrls.push(src);
          });
          
          if (mediaUrls.length === 0) {
              const ogImage = $('meta[property="og:image"]').attr('content');
              if (ogImage) mediaUrls.push(ogImage);
          }
      }

      // Final cleanup
      if (!contentText) {
          contentText = title;
      }

      return {
        platform: 'JINSHI' as any,
        authorName: '金十数据',
        avatarUrl: 'https://www.jin10.com/favicon.ico',
        title: title || '金十快讯',
        contentText: contentText,
        mediaUrls: mediaUrls,
      };
    } catch (error) {
      console.error("[Jinshi Parser Error]:", error);
      throw new Error("Jinshi Data scraping failed. The link may be invalid or the content is protected.");
    }
  }
}
