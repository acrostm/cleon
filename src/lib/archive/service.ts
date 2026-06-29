import crypto from "crypto";
import { Prisma } from "@prisma/client";

import {
  MAX_ARCHIVE_IMAGES,
  type ArchiveAccessState,
  type ArchiveAccountType,
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

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown archive error";

const toJsonInput = (value: unknown) =>
  value === null || value === undefined ? undefined : value as Prisma.InputJsonValue;

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

function calculateNextScanAt(intervalSeconds: number, consecutiveFailures: number) {
  const multiplier = consecutiveFailures >= 3 ? 4 : consecutiveFailures >= 2 ? 2 : 1;
  return addSeconds(new Date(), intervalSeconds * multiplier);
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
    const shouldPause = consecutiveFailures >= 5;
    const message = getErrorMessage(error);

    await prisma.archiveScanJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        finishedAt,
        durationMs,
        errorCode: message.includes("captcha") ? "CAPTCHA_REQUIRED" : "PARSE_ERROR",
        errorMessage: message,
      },
    });
    await prisma.archiveAccount.update({
      where: { id: account.id },
      data: {
        lastScannedAt: finishedAt,
        nextScanAt: calculateNextScanAt(account.scanIntervalSeconds, consecutiveFailures),
        consecutiveFailures,
        scanEnabled: shouldPause ? false : account.scanEnabled,
        status: shouldPause ? "paused" : "unstable",
      },
    });

    await notifyArchiveFailure({
      accountName: getAccountName(account),
      body: message,
      url: account.profileUrl,
    });

    if (shouldPause) {
      await notifyArchiveAccountPaused({
        accountName: getAccountName(account),
        body: `连续失败 ${consecutiveFailures} 次，已暂停自动扫描。`,
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

export function getInitialNextScanAt(accountType: ArchiveAccountType, scanIntervalSeconds: number) {
  return addSeconds(new Date(), scanIntervalSeconds);
}
