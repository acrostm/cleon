import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { requireOwnerRequest } from "@/lib/auth/session";

export const runtime = "nodejs";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Failed to fetch Cloudflare archive login status";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireOwnerRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const profile = await prisma.archiveAuthProfile.findUnique({ where: { id } });
    if (!profile) return NextResponse.json({ error: "Archive auth profile not found" }, { status: 404 });
    if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });

    const workerBaseUrl = profile.workerBaseUrl || process.env.ARCHIVE_CLOUDFLARE_WORKER_URL?.replace(/\/$/, "");
    const workerSecret = process.env.ARCHIVE_WORKER_SECRET || process.env.ARCHIVE_CRON_SECRET || process.env.CRON_SECRET;
    if (!workerBaseUrl || !workerSecret) {
      return NextResponse.json({ error: "Cloudflare archive worker is not configured" }, { status: 400 });
    }

    const workerUrl = new URL(`${workerBaseUrl}/auth/status`);
    workerUrl.searchParams.set("sessionId", sessionId);
    workerUrl.searchParams.set("authStateKey", profile.authStateKey || `xhs-auth/${profile.id}/storage-state.json`);
    const response = await fetch(workerUrl, {
      headers: { "Authorization": `Bearer ${workerSecret}` },
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

    return NextResponse.json({ success: true, data: data?.data });
  } catch (error) {
    console.error("[Archive Auth Profile Status Error]:", error);
    return NextResponse.json({
      error: getErrorMessage(error),
      details: process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
