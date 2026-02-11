import { NextRequest, NextResponse } from "next/server";
import { getComposio } from "@/lib/composio-server";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const composio = getComposio();
    const connections = await composio.getConnections(session.user.id);

    return NextResponse.json({ data: connections });
  } catch (error) {
    console.error("Error fetching Composio connections:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch connections" },
      { status: 500 }
    );
  }
}
