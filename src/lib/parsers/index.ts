import { TwitterParser } from './twitter';
import { BilibiliParser } from './bilibili';
import { WebParser } from './web';
import { XiaohongshuParser } from './xiaohongshu';
import { DouyinParser } from './douyin';
import { WechatParser } from './wechat';
import { YoutubeParser } from './youtube';

export interface ParsedData {
  platform: 'TWITTER' | 'BILIBILI' | 'WEB' | 'XIAOHONGSHU' | 'DOUYIN' | 'WECHAT' | 'YOUTUBE';
  authorName: string;
  avatarUrl: string;
  title?: string;
  contentText: string;
  mediaUrls: string[];
}

export interface ContentParser {
  match(url: string): boolean;
  parse(url: string): Promise<ParsedData>;
}

const parsers: ContentParser[] = [
  new TwitterParser(),
  new BilibiliParser(),
  new YoutubeParser(),
  new XiaohongshuParser(),
  new DouyinParser(),
  new WechatParser(),
  new WebParser(), // Always last as fallback
];

export function getParserForUrl(url: string): ContentParser {
  const parser = parsers.find(p => p.match(url));
  return parser || new WebParser();
}
