import { NextResponse } from "next/server";

import { requireArchiveCronRequest } from "@/lib/archive/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const unauthorized = requireArchiveCronRequest(req);
  if (unauthorized) return unauthorized;

  return NextResponse.json({
    success: true,
    data: {
      status: "ok",
      checkedAt: new Date().toISOString(),
    },
  });
}
