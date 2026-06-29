import { NextResponse } from "next/server";

import { recordArchiveAudit } from "@/lib/archive/audit";
import prisma from "@/lib/prisma";
import { requireOwnerRequest } from "@/lib/auth/session";

export const runtime = "nodejs";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Failed to process archive auth profile request";

export async function GET(req: Request) {
  const unauthorized = requireOwnerRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const profiles = await prisma.archiveAuthProfile.findMany({
      include: {
        accounts: {
          select: {
            id: true,
            profileUrl: true,
            displayName: true,
            nickname: true,
            status: true,
            authStatus: true,
          },
          orderBy: { updatedAt: "desc" },
        },
        _count: { select: { accounts: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ success: true, data: profiles });
  } catch (error) {
    console.error("[Archive Auth Profiles GET Error]:", error);
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
      name?: unknown;
      workerBaseUrl?: unknown;
    } | null;
    const name = typeof body?.name === "string" && body.name.trim()
      ? body.name.trim()
      : "XHS Cloudflare Auth";
    const workerBaseUrl = typeof body?.workerBaseUrl === "string" && body.workerBaseUrl.trim()
      ? body.workerBaseUrl.trim().replace(/\/$/, "")
      : process.env.ARCHIVE_CLOUDFLARE_WORKER_URL?.replace(/\/$/, "");
    const profile = await prisma.archiveAuthProfile.create({
      data: {
        name,
        workerBaseUrl,
        authStateKey: `xhs-auth/${crypto.randomUUID()}/storage-state.json`,
        status: "pending",
      },
    });

    await recordArchiveAudit({
      action: "AUTH_PROFILE_CREATED",
      targetType: "ArchiveAuthProfile",
      targetId: profile.id,
      metadata: { name, workerBaseUrl: Boolean(workerBaseUrl) },
      req,
    });

    return NextResponse.json({ success: true, data: profile }, { status: 201 });
  } catch (error) {
    console.error("[Archive Auth Profiles POST Error]:", error);
    return NextResponse.json({
      error: getErrorMessage(error),
      details: process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
