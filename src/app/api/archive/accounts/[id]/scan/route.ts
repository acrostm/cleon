import { NextResponse } from "next/server";

import { recordArchiveAudit } from "@/lib/archive/audit";
import { scanArchiveAccount } from "@/lib/archive/service";
import prisma from "@/lib/prisma";
import { requireOwnerRequest } from "@/lib/auth/session";

export const runtime = "nodejs";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Failed to scan archive account";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireOwnerRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const recentManualJob = await prisma.archiveScanJob.findFirst({
      where: {
        accountId: id,
        jobType: "manual_profile_scan",
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentManualJob) {
      return NextResponse.json({ error: "Manual scan is limited to once per account per minute" }, { status: 429 });
    }

    const job = await scanArchiveAccount({ accountId: id, manual: true });
    await recordArchiveAudit({
      action: "ACCOUNT_SCAN_STARTED",
      targetType: "ArchiveAccount",
      targetId: id,
      metadata: { jobId: job?.id },
      req,
    });

    return NextResponse.json({ success: true, data: job });
  } catch (error) {
    console.error("[Archive Account Scan Error]:", error);
    return NextResponse.json({
      error: getErrorMessage(error),
      details: process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
