import { NextResponse } from "next/server";

import { recordArchiveAudit } from "@/lib/archive/audit";
import prisma from "@/lib/prisma";
import { requireOwnerRequest } from "@/lib/auth/session";

export const runtime = "nodejs";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Failed to process archive auth profile";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireOwnerRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const profile = await prisma.archiveAuthProfile.findUnique({
      where: { id },
      include: {
        accounts: { orderBy: { updatedAt: "desc" } },
        _count: { select: { accounts: true } },
      },
    });
    if (!profile) return NextResponse.json({ error: "Archive auth profile not found" }, { status: 404 });

    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    console.error("[Archive Auth Profile GET Error]:", error);
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
    const existing = await prisma.archiveAuthProfile.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Archive auth profile not found" }, { status: 404 });

    const body = await req.json().catch(() => null) as {
      name?: unknown;
      workerBaseUrl?: unknown;
      action?: unknown;
    } | null;
    const action = typeof body?.action === "string" ? body.action : "";
    const status = action === "revoke" ? "revoked" : existing.status;
    const profile = await prisma.archiveAuthProfile.update({
      where: { id },
      data: {
        ...(typeof body?.name === "string" ? { name: body.name.trim() || existing.name } : {}),
        ...(typeof body?.workerBaseUrl === "string" ? { workerBaseUrl: body.workerBaseUrl.trim().replace(/\/$/, "") || null } : {}),
        status,
      },
    });

    if (action === "revoke") {
      await prisma.archiveAccount.updateMany({
        where: { authProfileId: profile.id },
        data: {
          authMode: "public",
          authStatus: "revoked",
          authFailureReason: "Auth profile revoked",
        },
      });
    }

    await recordArchiveAudit({
      action: action === "revoke" ? "AUTH_PROFILE_REVOKED" : "AUTH_PROFILE_UPDATED",
      targetType: "ArchiveAuthProfile",
      targetId: profile.id,
      metadata: { action },
      req,
    });

    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    console.error("[Archive Auth Profile PATCH Error]:", error);
    return NextResponse.json({
      error: getErrorMessage(error),
      details: process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
