import {
  buildCanonicalXiaohongshuPostUrl,
  getXiaohongshuNoteId,
  normalizeArchiveUrl,
} from '@/lib/archive/normalize';
import type {
  ArchiveAccessState,
  ParsedArchivePost,
  ParsedArchivePostCard,
  ParsedArchiveProfile,
} from '@/lib/archive/types';
import { fetchValidatedUrl } from '@/lib/utils/url';
import { ContentParser, ParsedData } from './index';

type XhsUser = {
  nickname?: string;
  nickName?: string;
  name?: string;
  avatar?: string;
  avatarUrl?: string;
  image?: string;
};

type XhsImage = {
  urlDefault?: string;
  infoList?: Array<{ url?: string }>;
  urlOriginal?: string;
  url?: string;
};

type XhsPost = {
  id?: string;
  noteId?: string;
  note_id?: string;
  user?: XhsUser;
  imageList?: XhsImage[];
  video?: {
    media?: {
      stream?: {
        h264?: Array<{ masterUrl?: string }>;
      };
    };
  };
  title?: string;
  desc?: string;
  time?: number | string;
  createTime?: number | string;
  create_time?: number | string;
  publishTime?: number | string;
  publish_time?: number | string;
};

type XhsState = {
  note?: {
    noteDetailMap?: Record<string, { note?: XhsPost }>;
  };
  noteData?: {
    noteDetailMap?: Record<string, { note?: XhsPost }>;
    data?: { noteData?: XhsPost };
    collectionData?: { userInfo?: XhsUser };
  };
};

const XHS_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

const normalizeEscapedHtml = (html: string) =>
  html.replace(/\\u002F/g, '/').replace(/\\\//g, '/');

function detectAccessStateFromHtml(status: number, html: string): ArchiveAccessState {
  const lowered = html.toLowerCase();

  if (status === 404 || lowered.includes('页面不存在') || lowered.includes('内容已删除')) {
    return 'deleted_or_hidden';
  }

  if (status === 401 || lowered.includes('login') || lowered.includes('登录后查看') || lowered.includes('请先登录')) {
    return 'login_required';
  }

  if (
    lowered.includes('captcha') ||
    (lowered.includes('验证') && lowered.includes('安全')) ||
    lowered.includes('滑块')
  ) {
    return 'captcha_required';
  }

  if (status === 403 || lowered.includes('access denied') || lowered.includes('访问受限') || lowered.includes('无权限')) {
    return 'restricted';
  }

  if (status >= 500) return 'unavailable';
  if (status >= 400) return 'unavailable';

  return 'visible';
}

function parseInitialState(html: string): XhsState | null {
  const normalizedHtml = normalizeEscapedHtml(html);
  const stateMatch = normalizedHtml.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})<\/script>/);
  if (!stateMatch) return null;

  return JSON.parse(stateMatch[1].replace(/undefined/g, 'null')) as XhsState;
}

function getPostFromState(state: XhsState) {
  const noteMap = state.note?.noteDetailMap || state.noteData?.noteDetailMap;
  if (noteMap) {
    const noteKeys = Object.keys(noteMap);
    if (noteKeys.length > 0) {
      const post = noteMap[noteKeys[0]].note ?? null;
      if (post) return post;
    }
  }

  return state.noteData?.data?.noteData ?? null;
}

function getFallbackUser(state: XhsState) {
  return state.noteData?.collectionData?.userInfo;
}

function extractImages(post: XhsPost) {
  const images: string[] = [];
  if (post.imageList && Array.isArray(post.imageList)) {
    post.imageList.forEach((img) => {
      if (img.urlDefault) images.push(img.urlDefault);
      else if (img.infoList && img.infoList[0]?.url) images.push(img.infoList[0].url);
      else if (img.urlOriginal) images.push(img.urlOriginal);
      else if (img.url) images.push(img.url);
    });
  }

  if (post.video?.media?.stream?.h264?.[0]?.masterUrl) {
    images.push(post.video.media.stream.h264[0].masterUrl);
  }

  return Array.from(new Set(images));
}

function parsePublishTime(post: XhsPost) {
  const value = post.publishTime ?? post.publish_time ?? post.createTime ?? post.create_time ?? post.time;
  if (!value) return undefined;

  if (typeof value === 'number') {
    const timestamp = value < 10_000_000_000 ? value * 1000 : value;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const numeric = Number.parseInt(value, 10);
  if (Number.isFinite(numeric)) {
    const timestamp = numeric < 10_000_000_000 ? numeric * 1000 : numeric;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function extractProfileNotes(html: string, profileUrl: string): ParsedArchivePostCard[] {
  const normalizedHtml = normalizeEscapedHtml(html);
  const cards = new Map<string, ParsedArchivePostCard>();
  const patterns = [
    /https?:\/\/(?:www\.)?xiaohongshu\.com\/(?:explore|discovery\/item)\/([a-zA-Z0-9]+)/g,
    /(?:href|url|link)["']?\s*:\s*["']\/(?:explore|discovery\/item)\/([a-zA-Z0-9]+)/g,
    /["']\/(?:explore|discovery\/item)\/([a-zA-Z0-9]{12,})/g,
  ];

  patterns.forEach((pattern) => {
    let match = pattern.exec(normalizedHtml);
    while (match) {
      const noteId = match[1];
      if (!cards.has(noteId)) {
        cards.set(noteId, {
          platformNoteId: noteId,
          originalUrl: buildCanonicalXiaohongshuPostUrl(noteId, profileUrl),
        });
      }
      match = pattern.exec(normalizedHtml);
    }
  });

  return Array.from(cards.values()).slice(0, 30);
}

export class XiaohongshuParser implements ContentParser {
  match(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return hostname === 'xiaohongshu.com' || hostname.endsWith('.xiaohongshu.com') || hostname === 'xhslink.com' || hostname.endsWith('.xhslink.com');
    } catch {
      return false;
    }
  }

  async parse(url: string): Promise<ParsedData> {
    try {
      const detail = await this.parsePostPage(url);

      return {
        platform: 'XIAOHONGSHU',
        authorName: detail.authorName || 'Unknown Red User',
        avatarUrl: '',
        title: detail.title || '',
        contentText: detail.contentText,
        mediaUrls: detail.imageUrls,
      };
    } catch (error) {
      console.error('[Xiaohongshu Parser Error]:', error);
      throw new Error('Xiaohongshu scraping failed. The platform may have blocked the request or the link is invalid.');
    }
  }

  async detectAccessState(url: string): Promise<ArchiveAccessState> {
    const normalizedUrl = normalizeArchiveUrl(url);
    const res = await fetchValidatedUrl(normalizedUrl, {
      headers: XHS_HEADERS,
    }, { timeoutMs: 12_000, maxBytes: 1_000_000 });
    const html = await res.text();
    return detectAccessStateFromHtml(res.status, html);
  }

  async parsePostPage(url: string): Promise<ParsedArchivePost> {
    const originalUrl = normalizeArchiveUrl(url);
    const platformNoteId = getXiaohongshuNoteId(originalUrl);
    const res = await fetchValidatedUrl(originalUrl, {
      headers: XHS_HEADERS,
    }, { timeoutMs: 12_000, maxBytes: 5_000_000 });
    const html = await res.text();
    const accessState = detectAccessStateFromHtml(res.status, html);

    if (accessState !== 'visible') {
      return {
        originalUrl,
        platformNoteId,
        contentText: '',
        imageUrls: [],
        accessState,
        rawData: { httpStatus: res.status },
      };
    }

    const state = parseInitialState(html);
    if (!state) {
      throw new Error('Failed to find Xiaohongshu INITIAL_STATE in HTML.');
    }

    const post = getPostFromState(state);
    if (!post) {
      throw new Error('Failed to find Xiaohongshu post payload in state.');
    }

    const fallbackUser = getFallbackUser(state);
    const authorName = post.user?.nickname
      || post.user?.nickName
      || post.user?.name
      || fallbackUser?.nickName
      || fallbackUser?.nickname
      || fallbackUser?.name
      || undefined;
    const imageUrls = extractImages(post);
    const noteId = post.id || post.noteId || post.note_id || platformNoteId;

    return {
      originalUrl: noteId ? buildCanonicalXiaohongshuPostUrl(noteId, originalUrl) : originalUrl,
      platformNoteId: noteId,
      title: post.title || '',
      contentText: post.desc || '',
      coverSourceUrl: imageUrls[0],
      authorName,
      publishTime: parsePublishTime(post),
      imageUrls,
      rawData: { note: post },
      accessState: 'visible',
    };
  }

  async parseProfilePage(profileUrl: string): Promise<ParsedArchiveProfile> {
    const normalizedProfileUrl = normalizeArchiveUrl(profileUrl);
    const res = await fetchValidatedUrl(normalizedProfileUrl, {
      headers: XHS_HEADERS,
    }, { timeoutMs: 15_000, maxBytes: 5_000_000 });
    const html = await res.text();
    const accessState = detectAccessStateFromHtml(res.status, html);

    if (accessState !== 'visible') {
      throw new Error(`Profile is not publicly accessible: ${accessState}`);
    }

    let nickname: string | undefined;
    let avatarUrl: string | undefined;
    const state = parseInitialState(html);
    const fallbackUser = state ? getFallbackUser(state) : undefined;
    if (fallbackUser) {
      nickname = fallbackUser.nickName || fallbackUser.nickname || fallbackUser.name;
      avatarUrl = fallbackUser.avatarUrl || fallbackUser.avatar || fallbackUser.image;
    }

    return {
      profileUrl: normalizedProfileUrl,
      platformUserId: new URL(normalizedProfileUrl).pathname.split('/').filter(Boolean).pop(),
      nickname,
      avatarUrl,
      notes: extractProfileNotes(html, normalizedProfileUrl),
      rawData: state ? { hasInitialState: true } : undefined,
    };
  }
}
