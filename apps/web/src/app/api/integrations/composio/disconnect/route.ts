import { NextRequest, NextResponse } from "next/server";
import { getComposio } from "@/lib/composio-server";
import { auth } from "@/lib/auth";

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { connectionId } = body;

    if (!connectionId) {
      return NextResponse.json(
        { error: "Missing connectionId parameter" },
        { status: 400 }
      );
    }

    const composio = getComposio();
    await composio.deleteConnection(connectionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting Composio:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to disconnect" },
      { status: 500 }
    );
  }
}
