import { NextResponse } from "next/server";

import { requireArchiveCronRequest } from "@/lib/archive/auth";
import { completeArchiveWorkerJob } from "@/lib/archive/service";

export const runtime = "nodejs";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Failed to save archive worker results";

export async function POST(req: Request) {
  const unauthorized = requireArchiveCronRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json().catch(() => null) as {
      jobId?: unknown;
      workerId?: unknown;
      status?: unknown;
      durationMs?: unknown;
      browserSeconds?: unknown;
      errorCode?: unknown;
      errorMessage?: unknown;
      profile?: unknown;
      posts?: unknown;
      rawResult?: unknown;
    } | null;
    if (typeof body?.jobId !== "string" || !body.jobId.trim()) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }
    if (body.status !== "success" && body.status !== "failed") {
      return NextResponse.json({ error: "status must be success or failed" }, { status: 400 });
    }

    const result = await completeArchiveWorkerJob({
      jobId: body.jobId.trim(),
      workerId: typeof body.workerId === "string" ? body.workerId : undefined,
      status: body.status,
      durationMs: typeof body.durationMs === "number" ? body.durationMs : undefined,
      browserSeconds: typeof body.browserSeconds === "number" ? body.browserSeconds : undefined,
      errorCode: typeof body.errorCode === "string" ? body.errorCode : undefined,
      errorMessage: typeof body.errorMessage === "string" ? body.errorMessage : undefined,
      profile: body.profile && typeof body.profile === "object" ? body.profile as never : undefined,
      posts: Array.isArray(body.posts) ? body.posts as never : undefined,
      rawResult: body.rawResult && typeof body.rawResult === "object" ? body.rawResult as Record<string, unknown> : undefined,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[Archive Worker Results Error]:", error);
    return NextResponse.json({
      error: getErrorMessage(error),
      details: process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
