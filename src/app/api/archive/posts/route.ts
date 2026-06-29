import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { requireOwnerRequest } from "@/lib/auth/session";

export const runtime = "nodejs";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Failed to fetch archive posts";

export async function GET(req: Request) {
  const unauthorized = requireOwnerRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(Number.parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(Math.max(Number.parseInt(searchParams.get("pageSize") || "20", 10), 1), 50);
    const keyword = searchParams.get("keyword")?.trim();
    const accountId = searchParams.get("accountId") || undefined;
    const status = searchParams.get("status") || undefined;
    const hasImages = searchParams.get("hasImages");

    const where: Prisma.ArchivePostWhereInput = {
      ...(accountId ? { accountId } : {}),
      ...(status ? { status } : {}),
      ...(hasImages === "true" ? { assets: { some: { downloadStatus: "success" } } } : {}),
      ...(hasImages === "false" ? { assets: { none: { downloadStatus: "success" } } } : {}),
      ...(keyword
        ? {
          OR: [
              { title: { contains: keyword, mode: Prisma.QueryMode.insensitive } },
              { contentText: { contains: keyword, mode: Prisma.QueryMode.insensitive } },
              { authorName: { contains: keyword, mode: Prisma.QueryMode.insensitive } },
              { originalUrl: { contains: keyword, mode: Prisma.QueryMode.insensitive } },
          ],
        }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.archivePost.findMany({
        where,
        include: {
          account: true,
          assets: {
            where: { downloadStatus: "success" },
            take: 4,
            orderBy: { createdAt: "asc" },
          },
          _count: {
            select: { assets: true, snapshots: true, statusEvents: true },
          },
        },
        orderBy: [{ firstSeenAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.archivePost.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("[Archive Posts GET Error]:", error);
    return NextResponse.json({
      error: getErrorMessage(error),
      details: process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
