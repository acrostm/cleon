export function getPlatformLogo(platform: string, originalUrl: string) {
  const p = platform.toUpperCase();
  switch (p) {
      case 'TWITTER': return `https://www.google.com/s2/favicons?domain=x.com&sz=128`;
      case 'BILIBILI': return `https://www.google.com/s2/favicons?domain=bilibili.com&sz=128`;
      case 'DOUYIN': return `https://www.douyin.com/favicon.ico`;
      case 'XIAOHONGSHU': 
          // Use a dedicated high-quality favicon for Xiaohongshu as Google's scraper often fails on it
          return `https://www.xiaohongshu.com/favicon.ico`;
      case 'WECHAT':
          // WeChat logo from a reliable source (res.wx.qq.com)
          return `https://res.wx.qq.com/a/wx_fed/assets/res/OTE0YTAw.png`;
      case 'YOUTUBE':
          return `https://www.google.com/s2/favicons?domain=youtube.com&sz=128`;
      case 'WEB': 
          let domain = 'example.com';
          try { domain = new URL(originalUrl).hostname; } catch(e) {}
          return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  }
  return `https://www.google.com/s2/favicons?domain=example.com&sz=128`;
}
