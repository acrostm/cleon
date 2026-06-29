import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { requireOwnerRequest } from "@/lib/auth/session";

export const runtime = "nodejs";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Failed to fetch archive dashboard";

export async function GET(req: Request) {
  const unauthorized = requireOwnerRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      accountCount,
      activeAccountCount,
      postCount,
      todayNewPostCount,
      recentNewPostCount,
      unavailablePostCount,
      failedAccountCount,
      queueBacklog,
      storageAggregate,
      latestPosts,
      failedScans,
      workerHeartbeats,
      authProfiles,
    ] = await Promise.all([
      prisma.archiveAccount.count(),
      prisma.archiveAccount.count({ where: { scanEnabled: true, status: { not: "paused" } } }),
      prisma.archivePost.count(),
      prisma.archivePost.count({ where: { firstSeenAt: { gte: todayStart } } }),
      prisma.archivePost.count({ where: { firstSeenAt: { gte: sevenDaysAgo } } }),
      prisma.archivePost.count({ where: { status: { in: ["unavailable", "deleted_or_hidden", "restricted", "login_required", "captcha_required"] } } }),
      prisma.archiveAccount.count({ where: { consecutiveFailures: { gt: 0 } } }),
      prisma.archiveScanJob.count({ where: { status: { in: ["pending", "running"] } } }),
      prisma.archiveAsset.aggregate({
        where: { downloadStatus: "success" },
        _sum: { sizeBytes: true },
      }),
      prisma.archivePost.findMany({
        include: { account: true, assets: { where: { downloadStatus: "success" }, take: 1 } },
        orderBy: { firstSeenAt: "desc" },
        take: 6,
      }),
      prisma.archiveScanJob.findMany({
        where: { status: "failed" },
        include: { account: true },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.archiveWorkerHeartbeat.findMany({
        orderBy: { lastSeenAt: "desc" },
        take: 3,
      }),
      prisma.archiveAuthProfile.findMany({
        include: { _count: { select: { accounts: true } } },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        accountCount,
        activeAccountCount,
        postCount,
        todayNewPostCount,
        recentNewPostCount,
        unavailablePostCount,
        failedAccountCount,
        queueBacklog,
        storageUsedBytes: storageAggregate._sum.sizeBytes || 0,
        latestPosts,
        failedScans,
        workerHeartbeats,
        authProfiles,
      },
    });
  } catch (error) {
    console.error("[Archive Dashboard GET Error]:", error);
    return NextResponse.json({
      error: getErrorMessage(error),
      details: process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
