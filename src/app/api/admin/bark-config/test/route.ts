import { NextResponse } from "next/server";

import { barkNotification } from "@/lib/notification";

export async function POST() {
  try {
    const testMessage = `这是一条 Cleon 测试通知\n\n测试时间: ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}\n\n如果你收到这条通知，说明 Bark 配置正常工作。`;

    const success = await barkNotification.sendQuickNotification(
      "Cleon Bark 测试",
      testMessage,
    );

    if (!success) {
      return NextResponse.json(
        { error: "Failed to send test notification" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send test notification:", error);
    return NextResponse.json(
      { error: "Failed to send test notification" },
      { status: 500 },
    );
  }
}
