import { NextResponse } from "next/server";

import { recordArchiveAudit } from "@/lib/archive/audit";
import prisma from "@/lib/prisma";
import { deleteMediaFromR2 } from "@/lib/r2";
import { requireOwnerRequest } from "@/lib/auth/session";

export const runtime = "nodejs";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Failed to process archive post request";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireOwnerRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const post = await prisma.archivePost.findUnique({
      where: { id },
      include: {
        account: true,
        assets: { orderBy: { createdAt: "asc" } },
        snapshots: { orderBy: { capturedAt: "desc" } },
        statusEvents: { orderBy: { checkedAt: "desc" } },
      },
    });

    if (!post) return NextResponse.json({ error: "Archive post not found" }, { status: 404 });

    await recordArchiveAudit({
      action: "NOTE_VIEWED",
      targetType: "ArchivePost",
      targetId: post.id,
      req,
    });

    return NextResponse.json({ success: true, data: post });
  } catch (error) {
    console.error("[Archive Post GET Error]:", error);
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
    const post = await prisma.archivePost.findUnique({
      where: { id },
      include: { assets: true },
    });
    if (!post) return NextResponse.json({ error: "Archive post not found" }, { status: 404 });

    for (const asset of post.assets) {
      if (asset.storageUrl) {
        const deleted = await deleteMediaFromR2(asset.storageUrl);
        if (!deleted) {
          return NextResponse.json({ error: "Failed to delete archive asset from storage" }, { status: 500 });
        }
      }
    }

    await prisma.archivePost.delete({ where: { id } });
    await recordArchiveAudit({
      action: "NOTE_DELETED",
      targetType: "ArchivePost",
      targetId: id,
      metadata: { originalUrl: post.originalUrl },
      req,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Archive Post DELETE Error]:", error);
    return NextResponse.json({
      error: getErrorMessage(error),
      details: process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
