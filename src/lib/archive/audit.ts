import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { getClientIp } from "@/lib/request";

type ArchiveAuditInput = {
  action: string;
  targetType?: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  req?: Request;
};

export async function recordArchiveAudit({
  action,
  targetType,
  targetId,
  metadata,
  req,
}: ArchiveAuditInput) {
  try {
    await prisma.archiveAuditLog.create({
      data: {
        actorId: "owner",
        actorName: "Owner",
        action,
        targetType,
        targetId: targetId || undefined,
        ipAddress: req ? getClientIp(req) : undefined,
        userAgent: req?.headers.get("user-agent") || undefined,
        metadata: metadata ? metadata as Prisma.InputJsonObject : undefined,
      },
    });
  } catch (error) {
    console.error("[Archive Audit Error]:", error);
  }
}
