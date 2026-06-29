import crypto from "crypto";
import { NextResponse } from "next/server";

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function isArchiveCronRequest(req: Request) {
  const secret = process.env.ARCHIVE_CRON_SECRET || process.env.CRON_SECRET || "";
  if (!secret) return false;

  const authorization = req.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  return Boolean(token && constantTimeEqual(token, secret));
}

export function requireArchiveCronRequest(req: Request) {
  if (!isArchiveCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized archive worker request" }, { status: 401 });
  }

  return null;
}
