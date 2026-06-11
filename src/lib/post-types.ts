export const platformValues = [
  "TWITTER",
  "BILIBILI",
  "WEB",
  "XIAOHONGSHU",
  "DOUYIN",
  "WECHAT",
  "YOUTUBE",
  "JINSHI",
] as const;

export type Platform = (typeof platformValues)[number];
export type PlatformFilter = "ALL" | Platform;

export type Post = {
  id: string;
  originalUrl: string;
  platform: Platform;
  authorName: string;
  avatarUrl: string;
  title?: string | null;
  contentText: string;
  mediaUrls: string[];
  createdAt: string;
};

export const platformMeta: Record<Platform, { label: string; tone: string }> = {
  TWITTER: { label: "X / Twitter", tone: "from-sky-400 to-slate-200" },
  BILIBILI: { label: "Bilibili", tone: "from-cyan-300 to-blue-500" },
  WEB: { label: "Web", tone: "from-emerald-300 to-teal-500" },
  XIAOHONGSHU: { label: "RED", tone: "from-rose-400 to-red-500" },
  DOUYIN: { label: "Douyin", tone: "from-fuchsia-400 to-cyan-300" },
  WECHAT: { label: "WeChat", tone: "from-lime-300 to-emerald-500" },
  YOUTUBE: { label: "YouTube", tone: "from-red-400 to-orange-400" },
  JINSHI: { label: "Jinshi", tone: "from-amber-300 to-yellow-500" },
};

export function getPostTitle(post: Post) {
  return post.title?.trim() || post.contentText.slice(0, 80) || "Untitled capture";
}

export function getPostPreview(post: Post, length = 180) {
  const source = post.contentText || post.title || "";
  const normalized = source.replace(/\s+/g, " ").trim();
  return normalized.length > length ? `${normalized.slice(0, length).trim()}...` : normalized;
}
