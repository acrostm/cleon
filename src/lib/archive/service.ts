import crypto from "crypto";
import { Prisma } from "@prisma/client";

import {
  MAX_ARCHIVE_IMAGES,
  type ArchiveAccessState,
  type ArchiveAccountType,
  type CloudflareArchiveAssetResult,
  type CloudflareArchivePostResult,
  type CloudflareArchiveProfileResult,
  type ParsedArchivePost,
} from "@/lib/archive/types";
import { normalizeArchiveUrl } from "@/lib/archive/normalize";
import {
  notifyArchiveAccountPaused,
  notifyArchiveFailure,
  notifyArchivePostCreated,
  notifyArchiveStatusChanged,
} from "@/lib/archive/notifications";
import prisma from "@/lib/prisma";
import { uploadArchiveMediaToR2 } from "@/lib/r2";
import { XiaohongshuParser } from "@/lib/parsers/xiaohongshu";

const parser = new XiaohongshuParser();

type ImportArchivePostInput = {
  url: string;
  accountId?: string | null;
  notify?: boolean;
};

type ScanArchiveAccountInput = {
  accountId: string;
  manual?: boolean;
};

type ClaimArchiveWorkerInput = {
  workerId: string;
  workerUrl?: string | null;
  limit?: number;
};

type CompleteArchiveWorkerJobInput = {
  jobId: string;
  workerId?: string;
  status: "success" | "failed";
  durationMs?: number;
  browserSeconds?: number;
  errorCode?: string;
  errorMessage?: string;
  profile?: CloudflareArchiveProfileResult;
  posts?: CloudflareArchivePostResult[];
  rawResult?: Record<string, unknown>;
};

type WorkerHeartbeatInput = {
  workerId: string;
  workerUrl?: string | null;
  status?: string;
  dailyBudgetSeconds?: number;
  dailyUsedSeconds?: number;
  pausedUntil?: Date | null;
  lastError?: string | null;
  metadata?: Record<string, unknown>;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown archive error";

const toJsonInput = (value: unknown) => {
  if (value === null || value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
};

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

function parseMaybeDate(value: unknown) {
  if (!value) return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value !== "string" && typeof value !== "number") return undefined;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function calculateNextScanAt(intervalSeconds: number, consecutiveFailures: number) {
  const multiplier = consecutiveFailures >= 3 ? 4 : consecutiveFailures >= 2 ? 2 : 1;
  return addSeconds(new Date(), intervalSeconds * multiplier);
}

function classifyScanFailure(message: string, consecutiveFailures: number) {
  const normalized = message.toLowerCase();

  if (normalized.includes("browser_budget_exceeded") || normalized.includes("browser time limit exceeded")) {
    return { errorCode: "BROWSER_BUDGET_EXCEEDED", accountStatus: "active", shouldPause: false };
  }

  if (normalized.includes("auth_expired")) {
    return { errorCode: "AUTH_EXPIRED", accountStatus: "login_required", shouldPause: true };
  }

  if (normalized.includes("auth_setup_failed")) {
    return { errorCode: "AUTH_SETUP_FAILED", accountStatus: "login_required", shouldPause: true };
  }

  if (normalized.includes("login_required")) {
    return { errorCode: "LOGIN_REQUIRED", accountStatus: "login_required", shouldPause: true };
  }

  if (normalized.includes("captcha_required") || normalized.includes("captcha")) {
    return { errorCode: "CAPTCHA_REQUIRED", accountStatus: "captcha_required", shouldPause: true };
  }

  if (normalized.includes("restricted") || normalized.includes("access_denied")) {
    return { errorCode: "ACCESS_DENIED", accountStatus: "restricted", shouldPause: consecutiveFailures >= 3 };
  }

  if (normalized.includes("timeout")) {
    return { errorCode: "PAGE_TIMEOUT", accountStatus: consecutiveFailures >= 5 ? "paused" : "unstable", shouldPause: consecutiveFailures >= 5 };
  }

  return { errorCode: "PARSE_ERROR", accountStatus: consecutiveFailures >= 5 ? "paused" : "unstable", shouldPause: consecutiveFailures >= 5 };
}

function authStatusFromFailure(errorCode?: string | null) {
  switch (errorCode) {
    case "LOGIN_REQUIRED":
    case "AUTH_EXPIRED":
      return "expired";
    case "CAPTCHA_REQUIRED":
      return "captcha_required";
    case "ACCESS_DENIED":
      return "restricted";
    case "AUTH_SETUP_FAILED":
      return "setup_failed";
    default:
      return undefined;
  }
}

function archiveStatusFromAccessState(accessState: ArchiveAccessState) {
  return accessState;
}

function contentHashFor(detail: ParsedArchivePost) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({
      title: detail.title || "",
      contentText: detail.contentText || "",
      authorName: detail.authorName || "",
      publishTime: detail.publishTime?.toISOString() || "",
      imageUrls: detail.imageUrls,
      status: detail.accessState,
    }))
    .digest("hex");
}

function getAccountName(account?: { displayName?: string | null; nickname?: string | null; profileUrl?: string | null } | null) {
  return account?.displayName || account?.nickname || account?.profileUrl || "Manual import";
}

async function createSnapshot(postId: string, triggerType: string) {
  const post = await prisma.archivePost.findUnique({
    where: { id: postId },
    include: {
      assets: {
        where: { downloadStatus: "success" },
        select: { sha256: true, storageUrl: true },
      },
    },
  });

  if (!post) return null;

  return prisma.archiveSnapshot.create({
    data: {
      postId,
      triggerType,
      title: post.title,
      contentText: post.contentText,
      status: post.status,
      contentHash: post.contentHash,
      assetHashes: post.assets.map((asset) => ({
        sha256: asset.sha256,
        storageUrl: asset.storageUrl,
      })) as Prisma.InputJsonValue,
      rawData: toJsonInput(post.rawData),
    },
  });
}

async function replaceArchiveAssets(post: { id: string; accountId: string | null }, detail: ParsedArchivePost) {
  const sourceUrls = Array.from(new Set([
    detail.coverSourceUrl,
    ...detail.imageUrls,
  ].filter((url): url is string => Boolean(url)))).slice(0, MAX_ARCHIVE_IMAGES);

  await prisma.archiveAsset.deleteMany({ where: { postId: post.id } });

  let coverStorageUrl: string | null = null;
  const successfulHashes: string[] = [];

  for (const [index, sourceUrl] of sourceUrls.entries()) {
    const assetType = index === 0 ? "cover" : "image";
    const upload = await uploadArchiveMediaToR2({
      url: sourceUrl,
      accountId: post.accountId,
      postId: post.id,
      assetType,
      index: Math.max(index, 1),
      referer: detail.originalUrl,
    });

    if (!upload) {
      await prisma.archiveAsset.create({
        data: {
          postId: post.id,
          assetType,
          sourceUrl,
          downloadStatus: "failed",
          errorMessage: "R2 upload failed or image was unsupported",
        },
      });
      continue;
    }

    if (!coverStorageUrl) coverStorageUrl = upload.storageUrl;
    successfulHashes.push(upload.sha256);

    await prisma.archiveAsset.create({
      data: {
        postId: post.id,
        assetType,
        sourceUrl,
        storageUrl: upload.storageUrl,
        sha256: upload.sha256,
        mimeType: upload.mimeType,
        sizeBytes: upload.sizeBytes,
        downloadStatus: "success",
      },
    });
  }

  await prisma.archivePost.update({
    where: { id: post.id },
    data: { coverStorageUrl },
  });

  return successfulHashes;
}

async function replaceArchiveAssetsFromWorker(post: { id: string; accountId: string | null }, assets: CloudflareArchiveAssetResult[] | undefined) {
  const normalizedAssets = (assets || [])
    .filter((asset) => asset.sourceUrl)
    .slice(0, MAX_ARCHIVE_IMAGES);

  if (normalizedAssets.length === 0) return [];

  await prisma.archiveAsset.deleteMany({ where: { postId: post.id } });

  let coverStorageUrl: string | null = null;
  const successfulHashes: string[] = [];

  for (const [index, asset] of normalizedAssets.entries()) {
    const downloadStatus = asset.downloadStatus || (asset.storageUrl ? "success" : "failed");
    if (asset.storageUrl && !coverStorageUrl) coverStorageUrl = asset.storageUrl;
    if (asset.sha256) successfulHashes.push(asset.sha256);

    await prisma.archiveAsset.create({
      data: {
        postId: post.id,
        assetType: asset.assetType || (index === 0 ? "cover" : "image"),
        sourceUrl: asset.sourceUrl,
        storageUrl: asset.storageUrl,
        sha256: asset.sha256,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        sizeBytes: asset.sizeBytes,
        downloadStatus,
        errorMessage: asset.errorMessage,
      },
    });
  }

  await prisma.archivePost.update({
    where: { id: post.id },
    data: { coverStorageUrl },
  });

  return successfulHashes;
}

async function upsertFailedArchivePost(url: string, accountId: string | null | undefined, error: unknown) {
  const message = getErrorMessage(error);
  const normalizedUrl = normalizeArchiveUrl(url);
  const existing = await prisma.archivePost.findUnique({ where: { originalUrl: normalizedUrl } });

  if (existing) {
    return prisma.archivePost.update({
      where: { id: existing.id },
      data: {
        accountId: accountId ?? existing.accountId,
        status: "parse_failed",
        archiveError: message,
        lastCheckedAt: new Date(),
      },
    });
  }

  return prisma.archivePost.create({
    data: {
      accountId: accountId || undefined,
      originalUrl: normalizedUrl,
      platformNoteId: undefined,
      title: undefined,
      contentText: "",
      status: "parse_failed",
      archiveError: message,
      lastCheckedAt: new Date(),
    },
  });
}

export async function importArchivePostFromUrl({ url, accountId, notify = true }: ImportArchivePostInput) {
  let detail: ParsedArchivePost;

  try {
    detail = await parser.parsePostPage(url);
  } catch (error) {
    const failedPost = await upsertFailedArchivePost(url, accountId, error);
    await createSnapshot(failedPost.id, failedPost.archivedAt ? "recheck" : "first_archive");
    if (notify) {
      await notifyArchiveFailure({
        title: failedPost.title,
        body: getErrorMessage(error),
        url: failedPost.originalUrl,
      });
    }
    throw error;
  }

  const now = new Date();
  const status = archiveStatusFromAccessState(detail.accessState);
  const contentHash = contentHashFor(detail);
  const existing = await prisma.archivePost.findUnique({
    where: { originalUrl: detail.originalUrl },
    include: { account: true },
  });
  const triggerType = !existing?.archivedAt
    ? "first_archive"
    : existing.contentHash !== contentHash
      ? "content_changed"
      : "recheck";

  const post = existing
    ? await prisma.archivePost.update({
      where: { id: existing.id },
      data: {
        accountId: accountId ?? existing.accountId,
        platformNoteId: detail.platformNoteId,
        title: detail.title,
        contentText: detail.contentText,
        coverSourceUrl: detail.coverSourceUrl,
        authorName: detail.authorName,
        publishTime: detail.publishTime,
        archivedAt: status === "visible" ? (existing.archivedAt || now) : existing.archivedAt,
        lastSeenAt: status === "visible" ? now : existing.lastSeenAt,
        lastCheckedAt: now,
        status,
        contentHash,
        rawData: toJsonInput(detail.rawData),
        archiveError: null,
      },
    })
    : await prisma.archivePost.create({
      data: {
        accountId: accountId || undefined,
        originalUrl: detail.originalUrl,
        platformNoteId: detail.platformNoteId,
        title: detail.title,
        contentText: detail.contentText,
        coverSourceUrl: detail.coverSourceUrl,
        authorName: detail.authorName,
        publishTime: detail.publishTime,
        archivedAt: status === "visible" ? now : undefined,
        lastSeenAt: status === "visible" ? now : undefined,
        lastCheckedAt: now,
        status,
        contentHash,
        rawData: toJsonInput(detail.rawData),
      },
    });

  if (status === "visible" && triggerType !== "recheck") {
    await replaceArchiveAssets(post, detail);
  }

  await createSnapshot(post.id, triggerType);

  const account = post.accountId
    ? await prisma.archiveAccount.findUnique({ where: { id: post.accountId } })
    : null;

  if (post.accountId && triggerType === "first_archive") {
    await prisma.archiveAccount.update({
      where: { id: post.accountId },
      data: { recentNewPostAt: now },
    });
  }

  if (notify && status === "visible" && triggerType === "first_archive") {
    await notifyArchivePostCreated({
      accountName: getAccountName(account),
      title: post.title,
      body: `图片数: ${detail.imageUrls.length}\n首次发现: ${now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`,
      url: post.originalUrl,
    });
  }

  return prisma.archivePost.findUnique({
    where: { id: post.id },
    include: {
      account: true,
      assets: true,
      snapshots: { orderBy: { capturedAt: "desc" }, take: 5 },
      statusEvents: { orderBy: { checkedAt: "desc" }, take: 5 },
    },
  });
}

async function upsertArchivePostFromWorker({
  detail,
  accountId,
  notify = true,
}: {
  detail: CloudflareArchivePostResult;
  accountId: string;
  notify?: boolean;
}) {
  const now = new Date();
  const status = archiveStatusFromAccessState(detail.accessState);
  const contentHash = contentHashFor(detail);
  const existing = await prisma.archivePost.findUnique({
    where: { originalUrl: detail.originalUrl },
    include: { account: true },
  });
  const triggerType = !existing?.archivedAt
    ? "first_archive"
    : existing.contentHash !== contentHash
      ? "content_changed"
      : "cloudflare_recheck";

  const post = existing
    ? await prisma.archivePost.update({
      where: { id: existing.id },
      data: {
        accountId,
        platformNoteId: detail.platformNoteId,
        title: detail.title,
        contentText: detail.contentText,
        coverSourceUrl: detail.coverSourceUrl,
        coverStorageUrl: detail.coverStorageUrl || existing.coverStorageUrl,
        authorName: detail.authorName,
        publishTime: parseMaybeDate(detail.publishTime),
        archivedAt: status === "visible" ? (existing.archivedAt || now) : existing.archivedAt,
        lastSeenAt: status === "visible" ? now : existing.lastSeenAt,
        lastCheckedAt: now,
        status,
        contentHash,
        rawData: toJsonInput(detail.rawData),
        archiveError: null,
      },
    })
    : await prisma.archivePost.create({
      data: {
        accountId,
        originalUrl: detail.originalUrl,
        platformNoteId: detail.platformNoteId,
        title: detail.title,
        contentText: detail.contentText,
        coverSourceUrl: detail.coverSourceUrl,
        coverStorageUrl: detail.coverStorageUrl,
        authorName: detail.authorName,
        publishTime: parseMaybeDate(detail.publishTime),
        archivedAt: status === "visible" ? now : undefined,
        lastSeenAt: status === "visible" ? now : undefined,
        lastCheckedAt: now,
        status,
        contentHash,
        rawData: toJsonInput(detail.rawData),
      },
    });

  if (existing && existing.status !== status) {
    await prisma.archiveStatusEvent.create({
      data: {
        postId: post.id,
        oldStatus: existing.status,
        newStatus: status,
        reason: "Cloudflare authorized worker status update",
      },
    });
  }

  if (detail.assets?.length) {
    await replaceArchiveAssetsFromWorker(post, detail.assets);
  }

  await createSnapshot(post.id, triggerType);

  if (triggerType === "first_archive") {
    await prisma.archiveAccount.update({
      where: { id: accountId },
      data: { recentNewPostAt: now },
    });
  }

  const account = await prisma.archiveAccount.findUnique({ where: { id: accountId } });
  if (notify && status === "visible" && triggerType === "first_archive") {
    await notifyArchivePostCreated({
      accountName: getAccountName(account),
      title: post.title,
      body: `Cloudflare 授权 worker 已归档，图片数: ${detail.assets?.length || detail.imageUrls.length}`,
      url: post.originalUrl,
    });
  }

  return post;
}

export async function recheckArchivePost(postId: string, notify = true) {
  const post = await prisma.archivePost.findUnique({
    where: { id: postId },
    include: { account: true },
  });
  if (!post) throw new Error("Archive post not found");

  const oldStatus = post.status;
  const accessState = await parser.detectAccessState(post.originalUrl);
  const newStatus = archiveStatusFromAccessState(accessState);
  const now = new Date();

  const updated = await prisma.archivePost.update({
    where: { id: post.id },
    data: {
      status: newStatus,
      lastCheckedAt: now,
      lastSeenAt: newStatus === "visible" ? now : post.lastSeenAt,
    },
  });

  if (oldStatus !== newStatus) {
    await prisma.archiveStatusEvent.create({
      data: {
        postId: post.id,
        oldStatus,
        newStatus,
        reason: `Access state changed to ${newStatus}`,
      },
    });
    await createSnapshot(post.id, "status_changed");

    if (notify) {
      await notifyArchiveStatusChanged({
        accountName: getAccountName(post.account),
        title: post.title,
        body: `${oldStatus} -> ${newStatus}`,
        url: post.originalUrl,
      });
    }
  }

  return updated;
}

export async function scanArchiveAccount({ accountId, manual = false }: ScanArchiveAccountInput) {
  const account = await prisma.archiveAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("Archive account not found");
  if (!manual && (!account.scanEnabled || account.status === "paused")) {
    throw new Error("Archive account scanning is paused");
  }

  const runningJob = await prisma.archiveScanJob.findFirst({
    where: {
      accountId,
      status: "running",
      startedAt: { gte: addSeconds(new Date(), -10 * 60) },
    },
  });
  if (runningJob) return runningJob;

  const startedAt = new Date();
  const job = await prisma.archiveScanJob.create({
    data: {
      accountId,
      jobType: manual ? "manual_profile_scan" : "profile_scan",
      status: "running",
      startedAt,
    },
  });

  try {
    const profile = await parser.parseProfilePage(account.profileUrl);
    let newCount = 0;

    await prisma.archiveAccount.update({
      where: { id: account.id },
      data: {
        nickname: profile.nickname,
        avatarUrl: profile.avatarUrl,
        platformUserId: profile.platformUserId,
      },
    });

    for (const card of profile.notes) {
      const existing = await prisma.archivePost.findUnique({ where: { originalUrl: card.originalUrl } });
      if (!existing) {
        newCount += 1;
        await prisma.archivePost.create({
          data: {
            accountId,
            originalUrl: card.originalUrl,
            platformNoteId: card.platformNoteId,
            title: card.title,
            coverSourceUrl: card.coverSourceUrl,
            authorName: card.authorName,
            contentText: "",
            status: "discovered",
          },
        });
      } else if (!existing.accountId) {
        await prisma.archivePost.update({
          where: { id: existing.id },
          data: { accountId },
        });
      }

      try {
        await importArchivePostFromUrl({ url: card.originalUrl, accountId, notify: newCount > 0 });
      } catch (error) {
        console.error("[Archive Scan Import Error]:", error);
      }
    }

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    await prisma.archiveScanJob.update({
      where: { id: job.id },
      data: {
        status: "success",
        finishedAt,
        durationMs,
        discoveredCount: profile.notes.length,
        newCount,
        rawResult: { notes: profile.notes },
      },
    });
    await prisma.archiveAccount.update({
      where: { id: account.id },
      data: {
        lastScannedAt: finishedAt,
        lastSuccessAt: finishedAt,
        nextScanAt: calculateNextScanAt(account.scanIntervalSeconds, 0),
        consecutiveFailures: 0,
        status: "active",
      },
    });

    return prisma.archiveScanJob.findUnique({ where: { id: job.id } });
  } catch (error) {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const consecutiveFailures = account.consecutiveFailures + 1;
    const message = getErrorMessage(error);
    const failure = classifyScanFailure(message, consecutiveFailures);

    await prisma.archiveScanJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        finishedAt,
        durationMs,
        errorCode: failure.errorCode,
        errorMessage: message,
      },
    });
    await prisma.archiveAccount.update({
      where: { id: account.id },
      data: {
        lastScannedAt: finishedAt,
        nextScanAt: calculateNextScanAt(account.scanIntervalSeconds, consecutiveFailures),
        consecutiveFailures,
        scanEnabled: failure.shouldPause ? false : account.scanEnabled,
        status: failure.accountStatus,
      },
    });

    await notifyArchiveFailure({
      accountName: getAccountName(account),
      body: message,
      url: account.profileUrl,
    });

    if (failure.shouldPause) {
      await notifyArchiveAccountPaused({
        accountName: getAccountName(account),
        body: `原因: ${failure.errorCode}\n连续失败 ${consecutiveFailures} 次，已暂停自动扫描。`,
        url: account.profileUrl,
      });
    }

    throw error;
  }
}

export async function runArchiveWorkerBatch(limit = 3) {
  const now = new Date();
  const statusCheckBefore = addSeconds(now, -24 * 60 * 60);
  const accounts = await prisma.archiveAccount.findMany({
    where: {
      scanEnabled: true,
      status: { not: "paused" },
      OR: [
        { nextScanAt: null },
        { nextScanAt: { lte: now } },
      ],
    },
    orderBy: [{ nextScanAt: "asc" }, { createdAt: "asc" }],
    take: limit,
  });

  const scanResults = [];
  for (const account of accounts) {
    try {
      scanResults.push(await scanArchiveAccount({ accountId: account.id }));
    } catch (error) {
      console.error("[Archive Worker Scan Error]:", error);
    }
  }

  const posts = await prisma.archivePost.findMany({
    where: {
      status: "visible",
      OR: [
        { lastCheckedAt: null },
        { lastCheckedAt: { lte: statusCheckBefore } },
      ],
    },
    orderBy: [{ lastCheckedAt: "asc" }, { firstSeenAt: "asc" }],
    take: limit * 5,
  });

  const statusResults = [];
  for (const post of posts) {
    try {
      statusResults.push(await recheckArchivePost(post.id));
    } catch (error) {
      console.error("[Archive Worker Recheck Error]:", error);
    }
  }

  return {
    scannedAccounts: scanResults.length,
    recheckedPosts: statusResults.length,
  };
}

export async function recordArchiveWorkerHeartbeat(input: WorkerHeartbeatInput) {
  const now = new Date();
  return prisma.archiveWorkerHeartbeat.upsert({
    where: { workerId: input.workerId },
    create: {
      workerId: input.workerId,
      workerUrl: input.workerUrl || undefined,
      status: input.status || "online",
      dailyBudgetSeconds: input.dailyBudgetSeconds ?? 600,
      dailyUsedSeconds: input.dailyUsedSeconds ?? 0,
      pausedUntil: input.pausedUntil || undefined,
      lastError: input.lastError || undefined,
      metadata: toJsonInput(input.metadata),
      lastSeenAt: now,
    },
    update: {
      workerUrl: input.workerUrl || undefined,
      status: input.status || "online",
      ...(input.dailyBudgetSeconds !== undefined ? { dailyBudgetSeconds: input.dailyBudgetSeconds } : {}),
      ...(input.dailyUsedSeconds !== undefined ? { dailyUsedSeconds: input.dailyUsedSeconds } : {}),
      pausedUntil: input.pausedUntil || undefined,
      lastError: input.lastError || undefined,
      metadata: toJsonInput(input.metadata),
      lastSeenAt: now,
    },
  });
}

export async function claimArchiveWorkerJobs({ workerId, workerUrl, limit = 1 }: ClaimArchiveWorkerInput) {
  await recordArchiveWorkerHeartbeat({
    workerId,
    workerUrl,
    status: "claiming",
  });

  const now = new Date();
  const runningThreshold = addSeconds(now, -10 * 60);
  const accounts = await prisma.archiveAccount.findMany({
    where: {
      scanEnabled: true,
      status: { notIn: ["paused", "captcha_required", "restricted"] },
      OR: [
        { nextScanAt: null },
        { nextScanAt: { lte: now } },
      ],
    },
    include: { authProfile: true },
    orderBy: [{ nextScanAt: "asc" }, { createdAt: "asc" }],
    take: Math.min(Math.max(limit * 4, 1), 12),
  });

  const jobs = [];
  for (const account of accounts) {
    if (jobs.length >= limit) break;
    if (account.status === "login_required" && account.authMode !== "authorized_browser") continue;
    if (account.authMode === "authorized_browser" && (!account.authProfile || account.authProfile.status !== "active")) continue;

    const runningJob = await prisma.archiveScanJob.findFirst({
      where: {
        accountId: account.id,
        status: "running",
        startedAt: { gte: runningThreshold },
      },
    });
    if (runningJob) continue;

    const job = await prisma.archiveScanJob.create({
      data: {
        accountId: account.id,
        jobType: account.authMode === "authorized_browser" ? "cloudflare_authorized_profile_scan" : "cloudflare_public_profile_scan",
        status: "running",
        startedAt: now,
        rawResult: {
          workerId,
          workerUrl,
          authMode: account.authMode,
        },
      },
    });

    jobs.push({
      jobId: job.id,
      account: {
        id: account.id,
        profileUrl: account.profileUrl,
        displayName: account.displayName,
        nickname: account.nickname,
        authMode: account.authMode,
        authStatus: account.authStatus,
        scanIntervalSeconds: account.scanIntervalSeconds,
        authProfile: account.authProfile
          ? {
            id: account.authProfile.id,
            name: account.authProfile.name,
            authStateKey: account.authProfile.authStateKey,
            status: account.authProfile.status,
          }
          : null,
      },
    });
  }

  return { jobs };
}

export async function completeArchiveWorkerJob(input: CompleteArchiveWorkerJobInput) {
  const job = await prisma.archiveScanJob.findUnique({
    where: { id: input.jobId },
    include: { account: { include: { authProfile: true } } },
  });
  if (!job || !job.account) throw new Error("Archive worker job not found");

  const account = job.account;
  const finishedAt = new Date();
  const durationMs = input.durationMs ?? (job.startedAt ? finishedAt.getTime() - job.startedAt.getTime() : undefined);

  if (input.workerId) {
    await recordArchiveWorkerHeartbeat({
      workerId: input.workerId,
      status: input.status === "success" ? "online" : "error",
      dailyUsedSeconds: input.browserSeconds,
      lastError: input.status === "failed" ? input.errorMessage || input.errorCode || null : null,
    });
  }

  if (input.status === "failed") {
    const consecutiveFailures = account.consecutiveFailures + 1;
    const message = input.errorMessage || input.errorCode || "Cloudflare archive worker failed";
    const failure = input.errorCode
      ? { errorCode: input.errorCode, accountStatus: classifyScanFailure(input.errorCode, consecutiveFailures).accountStatus, shouldPause: classifyScanFailure(input.errorCode, consecutiveFailures).shouldPause }
      : classifyScanFailure(message, consecutiveFailures);
    const authStatus = authStatusFromFailure(failure.errorCode);

    await prisma.archiveScanJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        finishedAt,
        durationMs,
        errorCode: failure.errorCode,
        errorMessage: message,
        rawResult: toJsonInput(input.rawResult),
      },
    });
    await prisma.archiveAccount.update({
      where: { id: account.id },
      data: {
        lastScannedAt: finishedAt,
        nextScanAt: failure.errorCode === "BROWSER_BUDGET_EXCEEDED"
          ? addSeconds(finishedAt, 60 * 60)
          : calculateNextScanAt(account.scanIntervalSeconds, consecutiveFailures),
        consecutiveFailures,
        scanEnabled: failure.shouldPause ? false : account.scanEnabled,
        status: failure.accountStatus,
        ...(authStatus
          ? {
            authStatus,
            lastAuthCheckAt: finishedAt,
            authFailureReason: message,
          }
          : {}),
      },
    });
    if (account.authProfileId && authStatus) {
      await prisma.archiveAuthProfile.update({
        where: { id: account.authProfileId },
        data: {
          status: authStatus === "expired" ? "pending" : authStatus,
          lastFailureAt: finishedAt,
          failureReason: message,
        },
      });
    }

    await notifyArchiveFailure({
      accountName: getAccountName(account),
      body: message,
      url: account.profileUrl,
    });
    if (failure.shouldPause) {
      await notifyArchiveAccountPaused({
        accountName: getAccountName(account),
        body: `原因: ${failure.errorCode}\nCloudflare worker 已暂停该账号。`,
        url: account.profileUrl,
      });
    }

    return prisma.archiveScanJob.findUnique({ where: { id: job.id } });
  }

  const posts = input.posts || [];
  let newCount = 0;
  if (input.profile) {
    await prisma.archiveAccount.update({
      where: { id: account.id },
      data: {
        nickname: input.profile.nickname,
        avatarUrl: input.profile.avatarUrl,
        platformUserId: input.profile.platformUserId,
      },
    });
  }

  for (const detail of posts) {
    const existing = await prisma.archivePost.findUnique({ where: { originalUrl: detail.originalUrl } });
    if (!existing) newCount += 1;
    await upsertArchivePostFromWorker({ detail, accountId: account.id, notify: !existing });
  }

  await prisma.archiveScanJob.update({
    where: { id: job.id },
    data: {
      status: "success",
      finishedAt,
      durationMs,
      discoveredCount: input.profile?.notes?.length ?? posts.length,
      newCount,
      rawResult: toJsonInput({
        workerId: input.workerId,
        browserSeconds: input.browserSeconds,
        profile: input.profile,
        postCount: posts.length,
        ...input.rawResult,
      }),
    },
  });
  await prisma.archiveAccount.update({
    where: { id: account.id },
    data: {
      lastScannedAt: finishedAt,
      lastSuccessAt: finishedAt,
      nextScanAt: calculateNextScanAt(account.scanIntervalSeconds, 0),
      consecutiveFailures: 0,
      status: "active",
      authStatus: account.authMode === "authorized_browser" ? "active" : account.authStatus,
      lastAuthCheckAt: account.authMode === "authorized_browser" ? finishedAt : account.lastAuthCheckAt,
      authFailureReason: null,
    },
  });
  if (account.authProfileId && account.authMode === "authorized_browser") {
    await prisma.archiveAuthProfile.update({
      where: { id: account.authProfileId },
      data: {
        status: "active",
        lastVerifiedAt: finishedAt,
        failureReason: null,
      },
    });
  }

  return prisma.archiveScanJob.findUnique({ where: { id: job.id } });
}

export function getInitialNextScanAt(accountType: ArchiveAccountType, scanIntervalSeconds: number) {
  return addSeconds(new Date(), scanIntervalSeconds);
}
