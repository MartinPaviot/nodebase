import { NextRequest, NextResponse } from "next/server";
import { getComposio } from "@/lib/composio-server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const appKey = searchParams.get("app");

    if (!appKey) {
      return NextResponse.json(
        { error: "Missing app parameter" },
        { status: 400 }
      );
    }

    const composio = getComposio();
    const actions = await composio.getActionsForApp(appKey);

    return NextResponse.json({ data: actions });
  } catch (error) {
    console.error("Error fetching Composio actions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch actions" },
      { status: 500 }
    );
  }
}
