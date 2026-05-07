import { NextRequest, NextResponse } from "next/server";

import {
  addBarkConfig,
  deleteBarkConfig,
  readBarkConfig,
  updateBarkConfig,
} from "@/lib/bark-config";

export async function GET() {
  try {
    const config = await readBarkConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("Failed to get bark config:", error);
    return NextResponse.json(
      { error: "Failed to get bark configuration" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name || !body.url || !body.defaultIcon) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const newConfig = await addBarkConfig({
      name: body.name,
      url: body.url,
      enabled: body.enabled ?? true,
      defaultGroup: body.defaultGroup ?? "Cleon",
      defaultCategory: body.defaultCategory ?? "通知",
      defaultIcon: body.defaultIcon,
      defaultSound: body.defaultSound ?? "default",
      description: body.description,
    });

    return NextResponse.json({ config: newConfig }, { status: 201 });
  } catch (error) {
    console.error("Failed to create bark config:", error);
    return NextResponse.json(
      { error: "Failed to create bark configuration" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "Missing configuration id" },
        { status: 400 },
      );
    }

    const updatedConfig = await updateBarkConfig(body.id, {
      name: body.name,
      url: body.url,
      enabled: body.enabled,
      defaultGroup: body.defaultGroup,
      defaultCategory: body.defaultCategory,
      defaultIcon: body.defaultIcon,
      defaultSound: body.defaultSound,
      description: body.description,
    });

    if (!updatedConfig) {
      return NextResponse.json(
        { error: "Bark configuration not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ config: updatedConfig });
  } catch (error) {
    console.error("Failed to update bark config:", error);
    return NextResponse.json(
      { error: "Failed to update bark configuration" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing configuration id" },
        { status: 400 },
      );
    }

    const success = await deleteBarkConfig(id);

    if (!success) {
      return NextResponse.json(
        { error: "Bark configuration not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete bark config:", error);
    return NextResponse.json(
      { error: "Failed to delete bark configuration" },
      { status: 500 },
    );
  }
}
