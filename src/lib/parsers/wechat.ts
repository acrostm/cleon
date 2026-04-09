import * as cheerio from 'cheerio';
import { ContentParser, ParsedData } from './index';

export class WechatParser implements ContentParser {
  match(url: string): boolean {
    return /mp\.weixin\.qq\.com/.test(url);
  }

  async parse(url: string): Promise<ParsedData> {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        }
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch WeChat article: ${res.statusText}`);
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      // Extract metadata from JavaScript variables or HTML elements
      const title = $('#activity-name').text().trim() || 
                    this.extractJSVar(html, 'msg_title') || 
                    $('meta[property="og:title"]').attr('content') || '';

      const authorName = $('#js_name').text().trim() || 
                         this.extractJSVar(html, 'nickname') || 
                         $('meta[name="author"]').attr('content') || 'WeChat Official Account';

      const avatarUrl = $('.profile_avatar img').attr('src') || 
                        this.extractJSVar(html, 'round_head_img') || '';

      // Extract content text - preserve line breaks from paragraphs and line breaks
      $('#js_content p, #js_content br').after('\n');
      const contentText = $('#js_content').text().trim();

      // Extract images from the content
      const mediaUrls: string[] = [];
      $('#js_content img').each((_, el) => {
        const dataSrc = $(el).attr('data-src');
        const src = $(el).attr('src');
        if (dataSrc) {
          mediaUrls.push(dataSrc);
        } else if (src && !src.includes('base64')) {
          mediaUrls.push(src);
        }
      });

      // Extract video URLs if any
      $('.video_iframe').each((_, el) => {
        const videoSrc = $(el).attr('data-src') || $(el).attr('src');
        if (videoSrc) {
           // For WeChat videos, we try to store the link. 
           // If it's a URL we can't play, it might be better to just show it in the text or as a separate section.
           mediaUrls.push(videoSrc);
        }
      });

      return {
        platform: 'WECHAT',
        authorName,
        avatarUrl: avatarUrl.replace(/\\x26/g, '&'),
        title: title.replace(/\\x26/g, '&'),
        contentText: contentText.replace(/\n\s*\n/g, '\n\n'), // Normalize double line breaks
        mediaUrls: [...new Set(mediaUrls.filter(url => url.startsWith('http')))], // Deduplicate
      };
    } catch (error) {
      console.error("[Wechat Parser Error]:", error);
      throw new Error("WeChat article scraping failed. The link may be invalid or the content is private.");
    }
  }

  private extractJSVar(html: string, varName: string): string {
    // WeChat vars can use double or single quotes
    const regex = new RegExp(`var ${varName}\\s*=\\s*["'](.*?)["'];`, 'i');
    const match = html.match(regex);
    if (match && match[1]) {
      return match[1];
    }
    return '';
  }
}
