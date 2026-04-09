import { TwitterParser } from './twitter';
import { BilibiliParser } from './bilibili';
import { WebParser } from './web';

export interface ParsedData {
  platform: 'TWITTER' | 'BILIBILI' | 'WEB';
  authorName: string;
  avatarUrl: string;
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
  new WebParser(), // Always last as fallback
];

export function getParserForUrl(url: string): ContentParser {
  const parser = parsers.find(p => p.match(url));
  return parser || new WebParser();
}
