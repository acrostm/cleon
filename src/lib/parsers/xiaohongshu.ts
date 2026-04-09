import { ContentParser, ParsedData } from './index';

export class XiaohongshuParser implements ContentParser {
  match(url: string): boolean {
    return /xiaohongshu\.com|xhslink\.com/.test(url);
  }

  async parse(url: string): Promise<ParsedData> {
    try {
      // Simulate normal mobile browser fetch to follow redirects and get HTML
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        }
      });
      
      const html = await res.text();
      
      // Look for the initial state hydration
      const stateMatch = html.match(/window\.__INITIAL_STATE__=({.*?})<\/script>/);
      
      if (!stateMatch) {
         throw new Error("Failed to find Xiaohongshu INITIAL_STATE in HTML.");
      }
      
      // Replace undefined with null to make it valid JSON
      const jsonString = stateMatch[1].replace(/undefined/g, 'null');
      const state = JSON.parse(jsonString);
      
      // The state structure typically holds the note deep inside
      const noteMap = state.note?.noteDetailMap || state.noteData?.noteDetailMap;
      if (!noteMap) {
         throw new Error("Failed to find noteDetailMap in Xiaohongshu state.");
      }
      
      const noteKeys = Object.keys(noteMap);
      if (noteKeys.length === 0) {
         throw new Error("Note detail map is empty.");
      }
      
      // Root note payload
      const post = noteMap[noteKeys[0]].note;
      
      // Extract Images
      const images: string[] = [];
      if (post.imageList && Array.isArray(post.imageList)) {
         post.imageList.forEach((img: any) => {
             // Prefer un-watermarked/hd options if available
             if (img.urlDefault) images.push(img.urlDefault);
             else if (img.urlOriginal) images.push(img.urlOriginal);
             else if (img.url) images.push(img.url);
         });
      }
      
      // Extract Video if present
      if (post.video?.media?.stream?.h264?.[0]?.masterUrl) {
         images.push(post.video.media.stream.h264[0].masterUrl);
      }
      
      return {
        platform: 'XIAOHONGSHU',
        authorName: post.user?.nickname || 'Unknown Red User',
        avatarUrl: post.user?.avatar || '',
        contentText: post.desc ? `${post.title ? post.title + '\n\n' : ''}${post.desc}` : post.title || '',
        mediaUrls: images
      };
      
    } catch (error) {
      console.error("[Xiaohongshu Parser Error]:", error);
      throw new Error("Xiaohongshu scraping failed. The platform may have blocked the request or the link is invalid.");
    }
  }
}
