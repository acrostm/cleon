import { NextResponse } from "next/server";

import { recordArchiveAudit } from "@/lib/archive/audit";
import { recheckArchivePost } from "@/lib/archive/service";
import { requireOwnerRequest } from "@/lib/auth/session";

export const runtime = "nodejs";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Failed to recheck archive post";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireOwnerRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const post = await recheckArchivePost(id);

    await recordArchiveAudit({
      action: "NOTE_RECHECKED",
      targetType: "ArchivePost",
      targetId: id,
      metadata: { status: post.status },
      req,
    });

    return NextResponse.json({ success: true, data: post });
  } catch (error) {
    console.error("[Archive Post Recheck Error]:", error);
    return NextResponse.json({
      error: getErrorMessage(error),
      details: process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
