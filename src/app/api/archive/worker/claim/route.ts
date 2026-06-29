import { NextResponse } from "next/server";

import { requireArchiveCronRequest } from "@/lib/archive/auth";
import { claimArchiveWorkerJobs } from "@/lib/archive/service";

export const runtime = "nodejs";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Failed to claim archive worker jobs";

export async function POST(req: Request) {
  const unauthorized = requireArchiveCronRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json().catch(() => null) as {
      workerId?: unknown;
      workerUrl?: unknown;
      limit?: unknown;
    } | null;
    const workerId = typeof body?.workerId === "string" && body.workerId.trim()
      ? body.workerId.trim()
      : "cloudflare-xhs-archive-worker";
    const workerUrl = typeof body?.workerUrl === "string" ? body.workerUrl.trim() : undefined;
    const rawLimit = typeof body?.limit === "number" ? body.limit : 1;
    const limit = Math.min(Math.max(Math.trunc(rawLimit), 1), 3);
    const result = await claimArchiveWorkerJobs({ workerId, workerUrl, limit });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[Archive Worker Claim Error]:", error);
    return NextResponse.json({
      error: getErrorMessage(error),
      details: process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
