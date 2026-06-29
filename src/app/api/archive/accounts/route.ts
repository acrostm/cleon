import { NextResponse } from "next/server";

import { recordArchiveAudit } from "@/lib/archive/audit";
import {
  normalizeAuthMode,
  normalizeAccountType,
  normalizeArchiveUrl,
  normalizeScanIntervalSeconds,
} from "@/lib/archive/normalize";
import { getInitialNextScanAt } from "@/lib/archive/service";
import prisma from "@/lib/prisma";
import { requireOwnerRequest } from "@/lib/auth/session";

export const runtime = "nodejs";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Failed to process archive account request";

export async function GET(req: Request) {
  const unauthorized = requireOwnerRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(req.url);
    const keyword = searchParams.get("keyword")?.trim();
    const status = searchParams.get("status") || undefined;
    const accountType = searchParams.get("accountType") || undefined;
    const scanEnabled = searchParams.get("scanEnabled");

    const accounts = await prisma.archiveAccount.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(accountType ? { accountType } : {}),
        ...(scanEnabled === "true" ? { scanEnabled: true } : {}),
        ...(scanEnabled === "false" ? { scanEnabled: false } : {}),
        ...(keyword
          ? {
            OR: [
              { displayName: { contains: keyword, mode: "insensitive" } },
              { nickname: { contains: keyword, mode: "insensitive" } },
              { profileUrl: { contains: keyword, mode: "insensitive" } },
              { remark: { contains: keyword, mode: "insensitive" } },
            ],
          }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        authProfile: true,
        _count: {
          select: { posts: true, scanJobs: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: accounts });
  } catch (error) {
    console.error("[Archive Accounts GET Error]:", error);
    return NextResponse.json({
      error: getErrorMessage(error),
      details: process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const unauthorized = requireOwnerRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json().catch(() => null) as {
      profileUrl?: unknown;
      displayName?: unknown;
      accountType?: unknown;
      authMode?: unknown;
      authProfileId?: unknown;
      scanIntervalSeconds?: unknown;
      remark?: unknown;
      consentNote?: unknown;
    } | null;
    const profileUrl = typeof body?.profileUrl === "string" ? normalizeArchiveUrl(body.profileUrl) : "";
    if (!profileUrl) {
      return NextResponse.json({ error: "profileUrl is required" }, { status: 400 });
    }

    const accountType = normalizeAccountType(body?.accountType);
    const authMode = normalizeAuthMode(body?.authMode);
    const authProfileId = typeof body?.authProfileId === "string" && body.authProfileId.trim()
      ? body.authProfileId.trim()
      : undefined;
    const scanIntervalSeconds = normalizeScanIntervalSeconds(accountType, body?.scanIntervalSeconds);
    const account = await prisma.archiveAccount.create({
      data: {
        profileUrl,
        displayName: typeof body?.displayName === "string" ? body.displayName.trim() || undefined : undefined,
        accountType,
        authMode,
        authProfileId,
        authStatus: authMode === "authorized_browser" ? "pending" : "none",
        scanIntervalSeconds,
        nextScanAt: getInitialNextScanAt(accountType, scanIntervalSeconds),
        remark: typeof body?.remark === "string" ? body.remark.trim() || undefined : undefined,
        consentNote: typeof body?.consentNote === "string" ? body.consentNote.trim() || undefined : undefined,
        consentStatus: accountType === "public" ? "unknown" : "recorded",
        createdBy: "owner",
      },
    });

    await recordArchiveAudit({
      action: "ACCOUNT_CREATED",
      targetType: "ArchiveAccount",
      targetId: account.id,
      metadata: { profileUrl, accountType, authMode, authProfileId, scanIntervalSeconds },
      req,
    });

    return NextResponse.json({ success: true, data: account }, { status: 201 });
  } catch (error) {
    console.error("[Archive Accounts POST Error]:", error);
    const message = getErrorMessage(error);
    return NextResponse.json({
      error: message.includes("Unique constraint") ? "Archive account already exists" : message,
      details: process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
