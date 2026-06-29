import { NextResponse } from "next/server";

import { requireArchiveCronRequest } from "@/lib/archive/auth";
import { runArchiveWorkerBatch } from "@/lib/archive/service";

export const runtime = "nodejs";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Failed to run archive worker";

async function runWorker(req: Request, limit: number) {
  const unauthorized = requireArchiveCronRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const result = await runArchiveWorkerBatch(limit);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[Archive Worker Run Error]:", error);
    return NextResponse.json({
      error: getErrorMessage(error),
      details: process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawLimit = Number.parseInt(searchParams.get("limit") || "3", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 10) : 3;
  return runWorker(req, limit);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { limit?: unknown } | null;
  const limit = typeof body?.limit === "number" && Number.isFinite(body.limit)
    ? Math.min(Math.max(Math.trunc(body.limit), 1), 10)
    : 3;
  return runWorker(req, limit);
}
