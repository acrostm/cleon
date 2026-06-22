import * as cheerio from 'cheerio';
import { ContentParser, ParsedData } from './index';
import { fetchValidatedUrl, validateUrl } from '@/lib/utils/url';

type JsonLdPerson = {
  name?: string;
  image?: string | { url?: string };
};

type JsonLdData = {
  '@type'?: string | string[];
  headline?: string;
  name?: string;
  author?: JsonLdPerson | JsonLdPerson[];
  publisher?: {
    name?: string;
    logo?: string | { url?: string };
  };
  articleBody?: string;
  description?: string;
  image?: string | { url?: string } | Array<string | { url?: string }>;
};

const readUrlLike = (value: string | { url?: string } | undefined) =>
  typeof value === 'string' ? value : value?.url || '';

export class WebParser implements ContentParser {
  match(url: string): boolean {
    try {
      const protocol = new URL(url).protocol;
      return protocol === 'http:' || protocol === 'https:';
    } catch {
      return false;
    }
  }

  async parse(url: string): Promise<ParsedData> {
    const res = await fetchValidatedUrl(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    }, { timeoutMs: 12_000, maxBytes: 4_000_000 });

    if (!res.ok) {
      throw new Error(`Failed to fetch web page: ${res.statusText}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    let title = '';
    let authorName = '';
    let avatarUrl = '';
    let contentText = '';
    let mediaUrls: string[] = [];

    // 1. Try JSON-LD Structured Data
    try {
      $('script[type="application/ld+json"]').each((_, element) => {
        try {
          const json = JSON.parse($(element).html() || '{}') as JsonLdData | JsonLdData[];
          const data = Array.isArray(json) ? json[0] : json;

          // Look for Article or BlogPosting types
          const dataType = data['@type'];
          const types = Array.isArray(dataType) ? dataType : [dataType];
          const isArticle = types.some((type) => type && ['Article', 'NewsArticle', 'BlogPosting', 'WebPage'].includes(type));
          if (isArticle || data.headline || data.author) {
            title = title || data.headline || data.name || '';
            
            // Author info
            if (data.author) {
              const author = Array.isArray(data.author) ? data.author[0] : data.author;
              authorName = authorName || author.name || '';
              avatarUrl = avatarUrl || readUrlLike(author.image);
            }

            // Publisher as fallback for author/avatar
            if (!authorName && data.publisher) {
              authorName = data.publisher.name || '';
              avatarUrl = avatarUrl || readUrlLike(data.publisher.logo);
            }

            // Content
            contentText = contentText || data.articleBody || data.description || '';
            
            // Images
            if (data.image) {
              const images = Array.isArray(data.image) ? data.image : [data.image];
              images.forEach((img) => {
                const imgUrl = readUrlLike(img);
                if (imgUrl && !mediaUrls.includes(imgUrl)) mediaUrls.push(imgUrl);
              });
            }
          }
        } catch {
          // Ignore invalid JSON
        }
      });
    } catch (e) {
      console.error('Error parsing JSON-LD:', e);
    }

    // 2. Fallback to Meta Tags (OpenGraph, Twitter, standard)
    title = title || 
            $('meta[property="og:title"]').attr('content') || 
            $('meta[name="twitter:title"]').attr('content') || 
            $('title').text().trim() || '';

    authorName = authorName || 
                 $('meta[name="author"]').attr('content') || 
                 $('meta[property="article:author"]').attr('content') || 
                 $('meta[name="twitter:creator"]').attr('content') || 
                 $('meta[property="og:site_name"]').attr('content') || 
                 new URL(url).hostname;

    const ogImage = $('meta[property="og:image"]').attr('content') || 
                    $('meta[name="twitter:image"]').attr('content') || 
                    $('meta[name="twitter:image:src"]').attr('content');
    if (ogImage && !mediaUrls.includes(ogImage)) {
      mediaUrls.unshift(ogImage); // OG image usually more relevant
    }

    // Avatar fallback: apple-touch-icon or favicon if no author avatar found
    if (!avatarUrl) {
      avatarUrl = $('link[rel="apple-touch-icon"]').attr('href') || 
                  $('link[rel="icon"]').attr('href') || 
                  $('link[rel="shortcut icon"]').attr('href') || '';
      
      // Handle relative URLs for avatar
      if (avatarUrl && !avatarUrl.startsWith('http')) {
        try {
          avatarUrl = new URL(avatarUrl, url).toString();
        } catch {}
      }
    }

    // 3. Content Extraction Heuristics
    if (!contentText) {
      // Priority 1: Meta description
      const metaDescription = $('meta[name="description"]').attr('content') || 
                               $('meta[property="og:description"]').attr('content') || 
                               $('meta[name="twitter:description"]').attr('content') || '';

      // Priority 2: Try to find main content in article or main tags
      const articleContent = $('article').text().trim() || $('main').text().trim();
      
      if (articleContent && articleContent.length > metaDescription.length) {
        contentText = articleContent.substring(0, 1000).replace(/\s+/g, ' ');
      } else {
        contentText = metaDescription;
      }

      // Fallback 3: Just grab some text from the body if everything else is empty
      if (!contentText.trim()) {
        const clone = $.load(html);
        clone('script, style, nav, footer, header').remove();
        const bodyText = clone('body').text().trim();
        if (bodyText) {
          contentText = bodyText.substring(0, 500).replace(/\s+/g, ' ');
        }
      }
    }

    // Clean up media URLs (handle relative paths)
    mediaUrls = mediaUrls.map(u => {
      if (u && !u.startsWith('http')) {
        try {
          return new URL(u, url).toString();
        } catch {
          return u;
        }
      }
      return u;
    }).filter((u) => !!u && validateUrl(u));

    return {
      platform: 'WEB',
      authorName: authorName.trim(),
      avatarUrl: avatarUrl,
      title: title.trim(),
      contentText: contentText.trim(),
      mediaUrls: mediaUrls.slice(0, 5), // Limit to 5 images
    };
  }
}
