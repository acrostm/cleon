import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { recordArchiveAudit } from "@/lib/archive/audit";
import prisma from "@/lib/prisma";
import { requireOwnerRequest } from "@/lib/auth/session";

export const runtime = "nodejs";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Failed to start Cloudflare archive login";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireOwnerRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const profile = await prisma.archiveAuthProfile.findUnique({ where: { id } });
    if (!profile) return NextResponse.json({ error: "Archive auth profile not found" }, { status: 404 });

    const workerBaseUrl = profile.workerBaseUrl || process.env.ARCHIVE_CLOUDFLARE_WORKER_URL?.replace(/\/$/, "");
    const workerSecret = process.env.ARCHIVE_WORKER_SECRET || process.env.ARCHIVE_CRON_SECRET || process.env.CRON_SECRET;
    if (!workerBaseUrl || !workerSecret) {
      return NextResponse.json({
        error: "Cloudflare archive worker is not configured. Set ARCHIVE_CLOUDFLARE_WORKER_URL and ARCHIVE_WORKER_SECRET.",
      }, { status: 400 });
    }

    const response = await fetch(`${workerBaseUrl}/auth/start`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${workerSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        authProfileId: profile.id,
        authStateKey: profile.authStateKey || `xhs-auth/${profile.id}/storage-state.json`,
      }),
    });
    const data = await response.json().catch(() => null) as {
      success?: boolean;
      data?: Record<string, unknown>;
      error?: string;
    } | null;
    if (!response.ok || data?.success === false) {
      throw new Error(data?.error || `Cloudflare worker returned ${response.status}`);
    }

    const updated = await prisma.archiveAuthProfile.update({
      where: { id: profile.id },
      data: {
        status: "pending",
        authStateKey: profile.authStateKey || `xhs-auth/${profile.id}/storage-state.json`,
        workerBaseUrl,
        lastLoginStartedAt: new Date(),
        failureReason: null,
        metadata: data?.data ? data.data as Prisma.InputJsonObject : undefined,
      },
    });

    await recordArchiveAudit({
      action: "AUTH_PROFILE_LOGIN_STARTED",
      targetType: "ArchiveAuthProfile",
      targetId: profile.id,
      metadata: { workerBaseUrl, sessionId: data?.data?.sessionId },
      req,
    });

    return NextResponse.json({ success: true, data: { profile: updated, worker: data?.data } });
  } catch (error) {
    console.error("[Archive Auth Profile Start Error]:", error);
    return NextResponse.json({
      error: getErrorMessage(error),
      details: process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
