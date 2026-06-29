import { acquire, connect, launch, type BrowserContextOptions, type BrowserWorker } from "@cloudflare/playwright";

type Env = {
  BROWSER: BrowserWorker;
  AUTH_STATE: KVNamespace;
  ARCHIVE_BUCKET: R2Bucket;
  CLEON_BASE_URL?: string;
  ARCHIVE_WORKER_SECRET?: string;
  AUTH_STATE_SECRET?: string;
  R2_PUBLIC_DOMAIN?: string;
  WORKER_ID?: string;
  BROWSER_DAILY_BUDGET_SECONDS?: string;
  BROWSER_DAILY_SOFT_LIMIT_SECONDS?: string;
  MAX_POSTS_PER_SCAN?: string;
};

type ArchiveAccessState =
  | "visible"
  | "unavailable"
  | "deleted_or_hidden"
  | "restricted"
  | "login_required"
  | "captcha_required"
  | "auth_expired"
  | "auth_setup_failed"
  | "parse_failed"
  | "unknown";

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
  title?: string;
  desc?: string;
  time?: number | string;
  createTime?: number | string;
  create_time?: number | string;
  publishTime?: number | string;
  publish_time?: number | string;
};

type XhsState = {
  note?: { noteDetailMap?: Record<string, { note?: XhsPost }> };
  noteData?: {
    noteDetailMap?: Record<string, { note?: XhsPost }>;
    data?: { noteData?: XhsPost };
    collectionData?: { userInfo?: XhsUser };
  };
};

type ArchiveJob = {
  jobId: string;
  account: {
    id: string;
    profileUrl: string;
    authMode: "public" | "authorized_browser";
    scanIntervalSeconds: number;
    authProfile?: {
      id: string;
      authStateKey?: string | null;
      status: string;
    } | null;
  };
};

type ParsedPostCard = {
  originalUrl: string;
  platformNoteId?: string;
  title?: string;
  coverSourceUrl?: string;
  authorName?: string;
};

type ParsedPost = {
  originalUrl: string;
  platformNoteId?: string;
  title?: string;
  contentText: string;
  coverSourceUrl?: string;
  coverStorageUrl?: string;
  authorName?: string;
  publishTime?: string;
  imageUrls: string[];
  rawData?: Record<string, unknown>;
  accessState: ArchiveAccessState;
  assets?: Array<{
    assetType: string;
    sourceUrl: string;
    storageUrl?: string;
    sha256?: string;
    mimeType?: string;
    sizeBytes?: number;
    downloadStatus: string;
    errorMessage?: string;
  }>;
};

type ParsedProfile = {
  profileUrl: string;
  platformUserId?: string;
  nickname?: string;
  avatarUrl?: string;
  notes: ParsedPostCard[];
  accessState?: ArchiveAccessState;
  rawData?: Record<string, unknown>;
};

type AuthSession = {
  authProfileId: string;
  authStateKey: string;
  createdAt: string;
};

type BrowserStorageState = Exclude<BrowserContextOptions["storageState"], string | undefined>;

const XHS_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const XHS_HEADERS = {
  "User-Agent": XHS_USER_AGENT,
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
};

const json = (body: unknown, init?: ResponseInit) =>
  Response.json(body, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

function getWorkerId(env: Env) {
  return env.WORKER_ID || "cloudflare-xhs-archive-worker";
}

function getWorkerUrl(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function requireWorkerSecret(request: Request, env: Env) {
  const secret = env.ARCHIVE_WORKER_SECRET || "";
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  return Boolean(secret && token && constantTimeEqual(token, secret));
}

function normalizeBaseUrl(value?: string) {
  return value?.replace(/\/$/, "");
}

function dailyUsageKey(date = new Date()) {
  return `browser-usage:${date.toISOString().slice(0, 10)}`;
}

async function getDailyUsage(env: Env) {
  const value = await env.AUTH_STATE.get(dailyUsageKey());
  return value ? Number.parseFloat(value) || 0 : 0;
}

async function addDailyUsage(env: Env, seconds: number) {
  const used = await getDailyUsage(env);
  const next = Math.max(0, used + seconds);
  await env.AUTH_STATE.put(dailyUsageKey(), String(next), { expirationTtl: 36 * 60 * 60 });
  return next;
}

async function postCleon(env: Env, path: string, body: Record<string, unknown>) {
  const baseUrl = normalizeBaseUrl(env.CLEON_BASE_URL);
  if (!baseUrl || !env.ARCHIVE_WORKER_SECRET) {
    throw new Error("CLEON_BASE_URL and ARCHIVE_WORKER_SECRET are required");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.ARCHIVE_WORKER_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null) as { success?: boolean; data?: unknown; error?: string } | null;
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || `Cleon API returned ${response.status}`);
  }
  return data?.data;
}

async function heartbeat(env: Env, request: Request | null, status: string, extra: Record<string, unknown> = {}) {
  if (!env.CLEON_BASE_URL || !env.ARCHIVE_WORKER_SECRET) return;
  const dailyBudgetSeconds = Number.parseInt(env.BROWSER_DAILY_BUDGET_SECONDS || "600", 10);
  const dailyUsedSeconds = await getDailyUsage(env);
  await postCleon(env, "/api/archive/worker/heartbeat", {
    workerId: getWorkerId(env),
    workerUrl: request ? getWorkerUrl(request) : undefined,
    status,
    dailyBudgetSeconds,
    dailyUsedSeconds,
    ...extra,
  });
}

function normalizeEscapedHtml(html: string) {
  return html.replace(/\\u002F/g, "/").replace(/\\\//g, "/");
}

function detectAccessState(status: number, html: string): ArchiveAccessState {
  const lowered = html.toLowerCase();
  if (status === 404 || lowered.includes("页面不存在") || lowered.includes("内容已删除")) return "deleted_or_hidden";
  if (status === 401 || lowered.includes("登录后查看") || lowered.includes("请先登录")) return "login_required";
  if (lowered.includes("captcha") || lowered.includes("滑块") || (lowered.includes("验证") && lowered.includes("安全"))) return "captcha_required";
  if (status === 403 || lowered.includes("access denied") || lowered.includes("访问受限") || lowered.includes("无权限")) return "restricted";
  if (status >= 500) return "unavailable";
  if (status >= 400) return "unavailable";
  return "visible";
}

function parseInitialState(html: string): XhsState | null {
  try {
    const normalizedHtml = normalizeEscapedHtml(html);
    const stateMatch = normalizedHtml.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})<\/script>/);
    if (!stateMatch) return null;
    return JSON.parse(stateMatch[1].replace(/undefined/g, "null")) as XhsState;
  } catch {
    return null;
  }
}

function getPostFromState(state: XhsState) {
  const noteMap = state.note?.noteDetailMap || state.noteData?.noteDetailMap;
  if (noteMap) {
    const firstKey = Object.keys(noteMap)[0];
    if (firstKey && noteMap[firstKey].note) return noteMap[firstKey].note;
  }
  return state.noteData?.data?.noteData ?? null;
}

function getFallbackUser(state: XhsState) {
  return state.noteData?.collectionData?.userInfo;
}

function getXiaohongshuNoteId(urlString: string) {
  try {
    const url = new URL(urlString);
    const segments = url.pathname.split("/").filter(Boolean);
    const exploreIndex = segments.findIndex((segment) => segment === "explore");
    if (exploreIndex >= 0 && segments[exploreIndex + 1]) return segments[exploreIndex + 1];
    const itemIndex = segments.findIndex((segment) => segment === "item");
    if (itemIndex >= 0 && segments[itemIndex + 1]) return segments[itemIndex + 1];
    return segments.find((segment) => /^[a-z0-9]{12,}$/i.test(segment));
  } catch {
    return undefined;
  }
}

function buildCanonicalPostUrl(noteId: string, sourceUrl?: string) {
  const suffix = sourceUrl ? new URL(sourceUrl).search : "";
  return `https://www.xiaohongshu.com/explore/${noteId}${suffix}`;
}

function parsePublishTime(post: XhsPost) {
  const value = post.publishTime ?? post.publish_time ?? post.createTime ?? post.create_time ?? post.time;
  if (!value) return undefined;
  const numeric = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (Number.isFinite(numeric)) {
    const timestamp = numeric < 10_000_000_000 ? numeric * 1000 : numeric;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function extractImages(post: XhsPost) {
  const images: string[] = [];
  post.imageList?.forEach((image) => {
    if (image.urlDefault) images.push(image.urlDefault);
    else if (image.infoList?.[0]?.url) images.push(image.infoList[0].url);
    else if (image.urlOriginal) images.push(image.urlOriginal);
    else if (image.url) images.push(image.url);
  });
  return Array.from(new Set(images));
}

function extractProfileNotes(html: string, profileUrl: string): ParsedPostCard[] {
  const normalizedHtml = normalizeEscapedHtml(html);
  const cards = new Map<string, ParsedPostCard>();
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
          originalUrl: buildCanonicalPostUrl(noteId, profileUrl),
        });
      }
      match = pattern.exec(normalizedHtml);
    }
  });
  return Array.from(cards.values()).slice(0, 30);
}

function parsePostPage(originalUrl: string, status: number, html: string): ParsedPost {
  const platformNoteId = getXiaohongshuNoteId(originalUrl);
  const accessState = detectAccessState(status, html);
  if (accessState !== "visible") {
    return {
      originalUrl,
      platformNoteId,
      contentText: "",
      imageUrls: [],
      accessState,
      rawData: { httpStatus: status },
    };
  }

  const state = parseInitialState(html);
  const post = state ? getPostFromState(state) : null;
  if (!post) {
    return {
      originalUrl,
      platformNoteId,
      contentText: "",
      imageUrls: [],
      accessState: "parse_failed",
      rawData: { reason: "INITIAL_STATE post payload not found" },
    };
  }

  const fallbackUser = getFallbackUser(state!);
  const noteId = post.id || post.noteId || post.note_id || platformNoteId;
  const imageUrls = extractImages(post);
  return {
    originalUrl: noteId ? buildCanonicalPostUrl(noteId, originalUrl) : originalUrl,
    platformNoteId: noteId,
    title: post.title || "",
    contentText: post.desc || "",
    coverSourceUrl: imageUrls[0],
    authorName: post.user?.nickname || post.user?.nickName || post.user?.name || fallbackUser?.nickname || fallbackUser?.nickName || fallbackUser?.name,
    publishTime: parsePublishTime(post),
    imageUrls,
    rawData: { note: post },
    accessState: "visible",
  };
}

function parseProfilePage(profileUrl: string, status: number, html: string): ParsedProfile {
  const accessState = detectAccessState(status, html);
  if (accessState !== "visible") {
    return {
      profileUrl,
      notes: [],
      accessState,
      rawData: { httpStatus: status },
    };
  }

  const state = parseInitialState(html);
  const fallbackUser = state ? getFallbackUser(state) : undefined;
  return {
    profileUrl,
    platformUserId: new URL(profileUrl).pathname.split("/").filter(Boolean).pop(),
    nickname: fallbackUser?.nickName || fallbackUser?.nickname || fallbackUser?.name,
    avatarUrl: fallbackUser?.avatarUrl || fallbackUser?.avatar || fallbackUser?.image,
    notes: extractProfileNotes(html, profileUrl),
    accessState: "visible",
    rawData: state ? { hasInitialState: true } : undefined,
  };
}

async function sha256Hex(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function encryptionKey(env: Env) {
  if (!env.AUTH_STATE_SECRET || env.AUTH_STATE_SECRET.length < 32) {
    throw new Error("AUTH_STATE_SECRET must be at least 32 characters");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.AUTH_STATE_SECRET));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptJson(env: Env, value: unknown) {
  const key = await encryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, payload);
  return JSON.stringify({
    v: 1,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted)),
  });
}

async function decryptJson(env: Env, encryptedValue: string) {
  const parsed = JSON.parse(encryptedValue) as { iv: string; data: string };
  const key = await encryptionKey(env);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(parsed.iv) },
    key,
    base64ToBytes(parsed.data),
  );
  return JSON.parse(new TextDecoder().decode(decrypted)) as unknown;
}

function isBrowserStorageState(value: unknown): value is BrowserStorageState {
  return Boolean(
    value
    && typeof value === "object"
    && Array.isArray((value as { cookies?: unknown }).cookies)
    && Array.isArray((value as { origins?: unknown }).origins),
  );
}

async function getStorageState(env: Env, key?: string | null) {
  if (!key) return undefined;
  const encryptedValue = await env.AUTH_STATE.get(key);
  if (!encryptedValue) return undefined;
  const state = await decryptJson(env, encryptedValue);
  return isBrowserStorageState(state) ? state : undefined;
}

async function putStorageState(env: Env, key: string, state: BrowserStorageState) {
  await env.AUTH_STATE.put(key, await encryptJson(env, state));
}

function isAuthenticatedStorageState(state: unknown) {
  const cookies = typeof state === "object" && state && "cookies" in state
    ? (state as { cookies?: Array<{ name?: string; domain?: string }> }).cookies || []
    : [];
  return cookies.some((cookie) =>
    (cookie.domain || "").includes("xiaohongshu.com")
    && ["web_session", "webId", "xsecappid"].includes(cookie.name || ""),
  );
}

async function uploadAsset(env: Env, accountId: string, post: ParsedPost, sourceUrl: string, index: number) {
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        ...XHS_HEADERS,
        Referer: post.originalUrl,
      },
    });
    if (!response.ok) throw new Error(`Image returned ${response.status}`);
    const contentLength = Number.parseInt(response.headers.get("content-length") || "0", 10);
    if (contentLength > 25 * 1024 * 1024) throw new Error("Image is larger than 25 MiB");
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 25 * 1024 * 1024) throw new Error("Image is larger than 25 MiB");

    const sha256 = await sha256Hex(buffer);
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const noteKey = post.platformNoteId || sha256.slice(0, 16);
    const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const key = `xhs-archive/account_${accountId}/post_${noteKey}/${index}_${sha256.slice(0, 12)}.${extension}`;
    await env.ARCHIVE_BUCKET.put(key, buffer, {
      httpMetadata: { contentType },
      customMetadata: {
        sourceUrl,
        accountId,
        noteId: post.platformNoteId || "",
      },
    });

    return {
      assetType: index === 0 ? "cover" : "image",
      sourceUrl,
      storageUrl: env.R2_PUBLIC_DOMAIN ? `${env.R2_PUBLIC_DOMAIN.replace(/\/$/, "")}/${key}` : `r2://${key}`,
      sha256,
      mimeType: contentType,
      sizeBytes: buffer.byteLength,
      downloadStatus: "success",
    };
  } catch (error) {
    return {
      assetType: index === 0 ? "cover" : "image",
      sourceUrl,
      downloadStatus: "failed",
      errorMessage: error instanceof Error ? error.message : "Image upload failed",
    };
  }
}

async function scanJob(env: Env, job: ArchiveJob) {
  const storageState = job.account.authMode === "authorized_browser"
    ? await getStorageState(env, job.account.authProfile?.authStateKey)
    : undefined;
  if (job.account.authMode === "authorized_browser" && !storageState) {
    throw new Error("auth_expired: Cloudflare auth state is missing");
  }

  const browser = await launch(env.BROWSER);
  try {
    const context = await browser.newContext({
      storageState,
      userAgent: XHS_USER_AGENT,
      locale: "zh-CN",
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const profileResponse = await page.goto(job.account.profileUrl, { waitUntil: "networkidle", timeout: 35_000 });
    const profileHtml = await page.content();
    const profile = parseProfilePage(job.account.profileUrl, profileResponse?.status() || 200, profileHtml);
    if (profile.accessState && profile.accessState !== "visible") {
      throw new Error(`${profile.accessState}: profile is not accessible to the Cloudflare browser`);
    }

    const maxPosts = Math.max(1, Math.min(Number.parseInt(env.MAX_POSTS_PER_SCAN || "8", 10), 12));
    const posts: ParsedPost[] = [];
    for (const card of profile.notes.slice(0, maxPosts)) {
      const postPage = await context.newPage();
      try {
        const response = await postPage.goto(card.originalUrl, { waitUntil: "networkidle", timeout: 35_000 });
        const html = await postPage.content();
        const post = parsePostPage(card.originalUrl, response?.status() || 200, html);
        const sourceUrls = Array.from(new Set([post.coverSourceUrl, ...post.imageUrls].filter((url): url is string => Boolean(url)))).slice(0, 8);
        const assets = [];
        for (const [index, sourceUrl] of sourceUrls.entries()) {
          assets.push(await uploadAsset(env, job.account.id, post, sourceUrl, index));
        }
        post.assets = assets;
        post.coverStorageUrl = assets.find((asset) => asset.downloadStatus === "success")?.storageUrl;
        posts.push(post);
      } finally {
        await postPage.close().catch(() => undefined);
      }
    }

    if (job.account.authMode === "authorized_browser" && job.account.authProfile?.authStateKey) {
      const updatedState = await context.storageState({ indexedDB: true });
      await putStorageState(env, job.account.authProfile.authStateKey, updatedState);
    }

    await context.close();
    return { profile, posts };
  } finally {
    await browser.close().catch(() => undefined);
  }
}

async function runOneBatch(env: Env, request: Request | null) {
  const softLimit = Number.parseInt(env.BROWSER_DAILY_SOFT_LIMIT_SECONDS || "540", 10);
  const used = await getDailyUsage(env);
  if (used >= softLimit) {
    await heartbeat(env, request, "budget_paused", {
      lastError: "BROWSER_BUDGET_EXCEEDED",
      pausedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    return { claimed: 0, completed: 0, skipped: "budget_paused" };
  }

  await heartbeat(env, request, "claiming");
  const claimed = await postCleon(env, "/api/archive/worker/claim", {
    workerId: getWorkerId(env),
    workerUrl: request ? getWorkerUrl(request) : undefined,
    limit: 1,
  }) as { jobs?: ArchiveJob[] } | undefined;
  const jobs = claimed?.jobs || [];
  let completed = 0;

  for (const job of jobs) {
    const startedAt = Date.now();
    try {
      const result = await scanJob(env, job);
      const browserSeconds = Math.ceil((Date.now() - startedAt) / 1000);
      const dailyUsedSeconds = await addDailyUsage(env, browserSeconds);
      await postCleon(env, "/api/archive/worker/results", {
        jobId: job.jobId,
        workerId: getWorkerId(env),
        status: "success",
        durationMs: Date.now() - startedAt,
        browserSeconds: dailyUsedSeconds,
        profile: result.profile,
        posts: result.posts,
      });
      completed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cloudflare archive worker failed";
      const browserSeconds = Math.ceil((Date.now() - startedAt) / 1000);
      const dailyUsedSeconds = await addDailyUsage(env, browserSeconds);
      await postCleon(env, "/api/archive/worker/results", {
        jobId: job.jobId,
        workerId: getWorkerId(env),
        status: "failed",
        durationMs: Date.now() - startedAt,
        browserSeconds: dailyUsedSeconds,
        errorCode: message.split(":")[0].toUpperCase(),
        errorMessage: message,
      }).catch(() => undefined);
    }
  }

  await heartbeat(env, request, "online");
  return { claimed: jobs.length, completed };
}

async function startAuth(request: Request, env: Env) {
  const body = await request.json().catch(() => null) as { authProfileId?: string; authStateKey?: string } | null;
  if (!body?.authProfileId || !body.authStateKey) {
    return json({ success: false, error: "authProfileId and authStateKey are required" }, { status: 400 });
  }

  const { sessionId } = await acquire(env.BROWSER, { keep_alive: 600_000 });
  const browser = await connect(env.BROWSER, sessionId);
  const context = await browser.newContext({
    userAgent: XHS_USER_AGENT,
    locale: "zh-CN",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("https://www.xiaohongshu.com/explore", { waitUntil: "networkidle", timeout: 35_000 }).catch(() => undefined);
  const screenshot = await page.screenshot({ type: "png" });
  await env.AUTH_STATE.put(`auth-session:${sessionId}`, JSON.stringify({
    authProfileId: body.authProfileId,
    authStateKey: body.authStateKey,
    createdAt: new Date().toISOString(),
  } satisfies AuthSession), { expirationTtl: 10 * 60 });

  return json({
    success: true,
    data: {
      sessionId,
      authStateKey: body.authStateKey,
      screenshotDataUrl: `data:image/png;base64,${bytesToBase64(new Uint8Array(screenshot))}`,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    },
  });
}

async function authStatus(request: Request, env: Env) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const authStateKey = url.searchParams.get("authStateKey");
  if (!sessionId || !authStateKey) {
    return json({ success: false, error: "sessionId and authStateKey are required" }, { status: 400 });
  }

  const sessionJson = await env.AUTH_STATE.get(`auth-session:${sessionId}`);
  if (!sessionJson) {
    return json({ success: true, data: { status: "expired", authenticated: false, message: "Login session expired" } });
  }

  const browser = await connect(env.BROWSER, sessionId);
  const context = browser.contexts()[0] || await browser.newContext({
    userAgent: XHS_USER_AGENT,
    locale: "zh-CN",
    viewport: { width: 390, height: 844 },
  });
  const page = context.pages()[0] || await context.newPage();
  await page.waitForTimeout(1000);
  const screenshot = await page.screenshot({ type: "png" });
  const storageState = await context.storageState({ indexedDB: true });
  const authenticated = isAuthenticatedStorageState(storageState);
  if (authenticated) {
    await putStorageState(env, authStateKey, storageState);
    await env.AUTH_STATE.delete(`auth-session:${sessionId}`);
    await browser.close();
  }

  return json({
    success: true,
    data: {
      status: authenticated ? "active" : "pending",
      authenticated,
      screenshotDataUrl: `data:image/png;base64,${bytesToBase64(new Uint8Array(screenshot))}`,
      message: authenticated ? "Login state saved" : "Waiting for Xiaohongshu login",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      await heartbeat(env, request, "online").catch(() => undefined);
      return json({ success: true, data: { workerId: getWorkerId(env), dailyUsedSeconds: await getDailyUsage(env) } });
    }

    if (!requireWorkerSecret(request, env)) {
      return json({ success: false, error: "Unauthorized archive worker request" }, { status: 401 });
    }

    try {
      if (url.pathname === "/auth/start" && request.method === "POST") return startAuth(request, env);
      if (url.pathname === "/auth/status" && request.method === "GET") return authStatus(request, env);
      if (url.pathname === "/run" && request.method === "POST") {
        const result = await runOneBatch(env, request);
        return json({ success: true, data: result });
      }
      return json({ success: false, error: "Not found" }, { status: 404 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cloudflare archive worker failed";
      await heartbeat(env, request, "error", { lastError: message }).catch(() => undefined);
      return json({ success: false, error: message }, { status: 500 });
    }
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runOneBatch(env, null).catch(async (error) => {
      const message = error instanceof Error ? error.message : "Scheduled archive worker failed";
      await heartbeat(env, null, "error", { lastError: message }).catch(() => undefined);
    }));
  },
} satisfies ExportedHandler<Env>;
