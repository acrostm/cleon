import { ContentParser, ParsedData } from './index';

export class DouyinParser implements ContentParser {
  match(url: string): boolean {
    return /douyin\.com/.test(url);
  }

  async parse(url: string): Promise<ParsedData> {
    try {
      // 1. Handle short URLs (v.douyin.com) to get actual video ID via redirect
      let finalUrl = url;
      let videoId = '';
      
      const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

      if (url.includes('v.douyin.com')) {
        const res = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          headers: { 'User-Agent': mobileUA }
        });
        finalUrl = res.url;
      }
      
      // 2. Extract Video ID from finalUrl
      const idMatch = finalUrl.match(/video\/(\d+)/);
      if (idMatch) {
          videoId = idMatch[1];
      } else {
          // Fallback logic for extraction
          try {
              const urlObj = new URL(finalUrl);
              const pathParts = urlObj.pathname.split('/').filter(Boolean);
              const lastPart = pathParts.pop();
              if (lastPart && /^\d+$/.test(lastPart)) {
                  videoId = lastPart;
              }
          } catch(e) {}
      }
      
      if (!videoId) {
          throw new Error("Could not extract Douyin video ID from URL.");
      }
      
      // 3. Fetch the mobile share page containing _ROUTER_DATA
      const shareUrl = `https://www.iesdouyin.com/share/video/${videoId}/`;
      const shareRes = await fetch(shareUrl, {
          headers: {
              'User-Agent': mobileUA,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          }
      });
      const html = await shareRes.text();
      
      // 4. Extract JSON from _ROUTER_DATA
      const routerDataMatch = html.match(/window\._ROUTER_DATA\s*=\s*({[\s\S]*?});<\/script>/);
      let videoInfo: any = null;
      
      if (routerDataMatch) {
          try {
              const data = JSON.parse(routerDataMatch[1]);
              const pageData = data.loaderData?.[`video_(id)/page`];
              if (pageData?.videoInfoRes?.item_list && pageData.videoInfoRes.item_list.length > 0) {
                  videoInfo = pageData.videoInfoRes.item_list[0];
              }
          } catch (e) {
              console.error("Failed to parse Douyin ROUTER_DATA:", e);
          }
      }
      
      if (!videoInfo) {
          throw new Error("Failed to find Douyin video payload in state.");
      }
      
      const authorName = videoInfo.author?.nickname || 'Douyin User';
      const avatarUrl = videoInfo.author?.avatar_thumb?.url_list?.[0] || 
                        videoInfo.author?.avatar_larger?.url_list?.[0] || '';
      
      const desc = videoInfo.desc || '';
      const coverUrl = videoInfo.video?.cover?.url_list?.[0] || 
                       videoInfo.video?.origin_cover?.url_list?.[0] || '';
                       
      const mediaUrls = [];
      if (coverUrl) {
          mediaUrls.push(coverUrl);
      }
      
      return {
          platform: 'DOUYIN',
          authorName: authorName,
          avatarUrl: avatarUrl,
          title: desc,
          contentText: desc,
          mediaUrls: mediaUrls
      };
      
    } catch (error) {
      console.error("[Douyin Parser Error]:", error);
      throw new Error("Douyin scraping failed. The platform may have blocked the request or the link is invalid.");
    }
  }
}
