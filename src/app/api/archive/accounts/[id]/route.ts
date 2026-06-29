import { NextResponse } from "next/server";

import { recordArchiveAudit } from "@/lib/archive/audit";
import {
  normalizeAuthMode,
  normalizeAccountType,
  normalizeArchiveUrl,
  normalizeScanIntervalSeconds,
} from "@/lib/archive/normalize";
import prisma from "@/lib/prisma";
import { requireOwnerRequest } from "@/lib/auth/session";

export const runtime = "nodejs";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Failed to process archive account request";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireOwnerRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const account = await prisma.archiveAccount.findUnique({
      where: { id },
      include: {
        authProfile: true,
        posts: { orderBy: { firstSeenAt: "desc" }, take: 20 },
        scanJobs: { orderBy: { createdAt: "desc" }, take: 20 },
        _count: { select: { posts: true, scanJobs: true } },
      },
    });

    if (!account) return NextResponse.json({ error: "Archive account not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: account });
  } catch (error) {
    console.error("[Archive Account GET Error]:", error);
    return NextResponse.json({
      error: getErrorMessage(error),
      details: process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireOwnerRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const existing = await prisma.archiveAccount.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Archive account not found" }, { status: 404 });

    const body = await req.json().catch(() => null) as {
      profileUrl?: unknown;
      displayName?: unknown;
      accountType?: unknown;
      authMode?: unknown;
      authProfileId?: unknown;
      scanIntervalSeconds?: unknown;
      remark?: unknown;
      consentNote?: unknown;
      scanEnabled?: unknown;
      action?: unknown;
    } | null;
    const accountType = body?.accountType ? normalizeAccountType(body.accountType) : normalizeAccountType(existing.accountType);
    const authMode = body?.authMode ? normalizeAuthMode(body.authMode) : normalizeAuthMode(existing.authMode);
    const authProfileId = typeof body?.authProfileId === "string"
      ? body.authProfileId.trim() || null
      : body?.authProfileId === null
        ? null
        : existing.authProfileId;
    const scanIntervalSeconds = body?.scanIntervalSeconds !== undefined
      ? normalizeScanIntervalSeconds(accountType, body.scanIntervalSeconds)
      : existing.scanIntervalSeconds;
    const action = typeof body?.action === "string" ? body.action : "";
    const shouldRefreshNextScan = action === "resume"
      || body?.scanIntervalSeconds !== undefined
      || body?.accountType !== undefined
      || body?.authMode !== undefined
      || body?.authProfileId !== undefined;
    const scanEnabled = action === "pause"
      ? false
      : action === "resume"
        ? true
        : typeof body?.scanEnabled === "boolean"
          ? body.scanEnabled
          : existing.scanEnabled;

    const account = await prisma.archiveAccount.update({
      where: { id },
      data: {
        ...(typeof body?.profileUrl === "string" ? { profileUrl: normalizeArchiveUrl(body.profileUrl) } : {}),
        ...(typeof body?.displayName === "string" ? { displayName: body.displayName.trim() || null } : {}),
        accountType,
        authMode,
        authProfileId,
        authStatus: authMode === "authorized_browser"
          ? existing.authStatus === "none" ? "pending" : existing.authStatus
          : "none",
        authFailureReason: authMode === "authorized_browser" ? existing.authFailureReason : null,
        scanIntervalSeconds,
        ...(typeof body?.remark === "string" ? { remark: body.remark.trim() || null } : {}),
        ...(typeof body?.consentNote === "string" ? { consentNote: body.consentNote.trim() || null } : {}),
        scanEnabled,
        status: scanEnabled ? "active" : "paused",
        nextScanAt: scanEnabled
          ? shouldRefreshNextScan
            ? new Date(Date.now() + scanIntervalSeconds * 1000)
            : existing.nextScanAt || new Date(Date.now() + scanIntervalSeconds * 1000)
          : existing.nextScanAt,
      },
    });

    await recordArchiveAudit({
      action: action === "pause" ? "ACCOUNT_SCAN_STOPPED" : action === "resume" ? "ACCOUNT_SCAN_STARTED" : "ACCOUNT_UPDATED",
      targetType: "ArchiveAccount",
      targetId: account.id,
      metadata: { action, scanEnabled, scanIntervalSeconds, authMode, authProfileId },
      req,
    });

    return NextResponse.json({ success: true, data: account });
  } catch (error) {
    console.error("[Archive Account PATCH Error]:", error);
    return NextResponse.json({
      error: getErrorMessage(error),
      details: process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireOwnerRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const existing = await prisma.archiveAccount.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Archive account not found" }, { status: 404 });

    await prisma.archiveAccount.delete({ where: { id } });
    await recordArchiveAudit({
      action: "ACCOUNT_DELETED",
      targetType: "ArchiveAccount",
      targetId: id,
      metadata: { profileUrl: existing.profileUrl },
      req,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Archive Account DELETE Error]:", error);
    return NextResponse.json({
      error: getErrorMessage(error),
      details: process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
