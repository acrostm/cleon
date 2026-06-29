import { NextResponse } from "next/server";

import { recordArchiveAudit } from "@/lib/archive/audit";
import { importArchivePostFromUrl } from "@/lib/archive/service";
import { requireOwnerRequest } from "@/lib/auth/session";

export const runtime = "nodejs";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Failed to import archive post";

export async function POST(req: Request) {
  const unauthorized = requireOwnerRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json().catch(() => null) as { url?: unknown; accountId?: unknown } | null;
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const accountId = typeof body?.accountId === "string" && body.accountId.trim() ? body.accountId.trim() : undefined;
    const post = await importArchivePostFromUrl({ url, accountId });

    await recordArchiveAudit({
      action: "NOTE_IMPORTED",
      targetType: "ArchivePost",
      targetId: post?.id,
      metadata: { url, accountId },
      req,
    });

    return NextResponse.json({ success: true, data: post }, { status: 201 });
  } catch (error) {
    console.error("[Archive Post Import Error]:", error);
    return NextResponse.json({
      error: getErrorMessage(error),
      details: process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
