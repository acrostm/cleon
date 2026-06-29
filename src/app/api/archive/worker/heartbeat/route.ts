import { NextResponse } from "next/server";

import { requireArchiveCronRequest } from "@/lib/archive/auth";
import { recordArchiveWorkerHeartbeat } from "@/lib/archive/service";

export const runtime = "nodejs";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Failed to record archive worker heartbeat";

export async function POST(req: Request) {
  const unauthorized = requireArchiveCronRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json().catch(() => null) as {
      workerId?: unknown;
      workerUrl?: unknown;
      status?: unknown;
      dailyBudgetSeconds?: unknown;
      dailyUsedSeconds?: unknown;
      pausedUntil?: unknown;
      lastError?: unknown;
      metadata?: unknown;
    } | null;
    const workerId = typeof body?.workerId === "string" && body.workerId.trim()
      ? body.workerId.trim()
      : "cloudflare-xhs-archive-worker";
    const heartbeat = await recordArchiveWorkerHeartbeat({
      workerId,
      workerUrl: typeof body?.workerUrl === "string" ? body.workerUrl.trim() : undefined,
      status: typeof body?.status === "string" ? body.status : "online",
      dailyBudgetSeconds: typeof body?.dailyBudgetSeconds === "number" ? body.dailyBudgetSeconds : undefined,
      dailyUsedSeconds: typeof body?.dailyUsedSeconds === "number" ? body.dailyUsedSeconds : undefined,
      pausedUntil: typeof body?.pausedUntil === "string" ? new Date(body.pausedUntil) : undefined,
      lastError: typeof body?.lastError === "string" ? body.lastError : undefined,
      metadata: body?.metadata && typeof body.metadata === "object" ? body.metadata as Record<string, unknown> : undefined,
    });

    return NextResponse.json({ success: true, data: heartbeat });
  } catch (error) {
    console.error("[Archive Worker Heartbeat Error]:", error);
    return NextResponse.json({
      error: getErrorMessage(error),
      details: process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
