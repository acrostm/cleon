import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { recordArchiveAudit } from "@/lib/archive/audit";
import prisma from "@/lib/prisma";
import { requireOwnerRequest } from "@/lib/auth/session";

export const runtime = "nodejs";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Failed to submit Xiaohongshu verification code";

const normalizeVerificationCode = (value: unknown) =>
  typeof value === "string" ? value.replace(/\D/g, "").slice(0, 8) : "";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireOwnerRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null) as {
      sessionId?: unknown;
      code?: unknown;
      verificationCode?: unknown;
    } | null;
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
    const verificationCode = normalizeVerificationCode(body?.code || body?.verificationCode);

    if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    if (verificationCode.length < 4) {
      return NextResponse.json({ error: "Verification code must be at least 4 digits" }, { status: 400 });
    }

    const profile = await prisma.archiveAuthProfile.findUnique({ where: { id } });
    if (!profile) return NextResponse.json({ error: "Archive auth profile not found" }, { status: 404 });

    const workerBaseUrl = (profile.workerBaseUrl || process.env.ARCHIVE_CLOUDFLARE_WORKER_URL)?.replace(/\/$/, "");
    const workerSecret = process.env.ARCHIVE_WORKER_SECRET || process.env.ARCHIVE_CRON_SECRET || process.env.CRON_SECRET;
    if (!workerBaseUrl || !workerSecret) {
      return NextResponse.json({ error: "Cloudflare archive worker is not configured" }, { status: 400 });
    }

    const response = await fetch(`${workerBaseUrl}/auth/submit-code`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${workerSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        authStateKey: profile.authStateKey || `xhs-auth/${profile.id}/storage-state.json`,
        verificationCode,
      }),
    });
    const data = await response.json().catch(() => null) as {
      success?: boolean;
      data?: {
        status?: string;
        authenticated?: boolean;
        screenshotDataUrl?: string;
        message?: string;
      };
      error?: string;
    } | null;
    if (!response.ok || data?.success === false) {
      throw new Error(data?.error || `Cloudflare worker returned ${response.status}`);
    }

    if (data?.data?.authenticated) {
      await prisma.archiveAuthProfile.update({
        where: { id: profile.id },
        data: {
          status: "active",
          lastVerifiedAt: new Date(),
          failureReason: null,
          metadata: data.data as Prisma.InputJsonObject,
        },
      });
      await prisma.archiveAccount.updateMany({
        where: { authProfileId: profile.id, authMode: "authorized_browser" },
        data: {
          authStatus: "active",
          authFailureReason: null,
          scanEnabled: true,
          status: "active",
        },
      });
    }

    await recordArchiveAudit({
      action: "AUTH_PROFILE_VERIFICATION_CODE_SUBMITTED",
      targetType: "ArchiveAuthProfile",
      targetId: profile.id,
      metadata: {
        sessionId,
        status: data?.data?.status,
        authenticated: Boolean(data?.data?.authenticated),
      },
      req,
    });

    return NextResponse.json({ success: true, data: data?.data });
  } catch (error) {
    console.error("[Archive Auth Profile Submit Code Error]:", error);
    return NextResponse.json({
      error: getErrorMessage(error),
      details: process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
