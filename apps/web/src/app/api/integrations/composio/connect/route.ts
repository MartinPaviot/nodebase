import { NextRequest, NextResponse } from "next/server";
import { getComposio } from "@/lib/composio-server";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { appName, redirectUrl } = body;

    if (!appName) {
      return NextResponse.json(
        { error: "Missing appName parameter" },
        { status: 400 }
      );
    }

    const composio = getComposio();
    const connection = await composio.initiateConnection({
      userId: session.user.id,
      appName,
      redirectUrl: redirectUrl || `${process.env.NEXT_PUBLIC_APP_URL}/integrations`,
    });

    return NextResponse.json({ data: connection });
  } catch (error) {
    console.error("Error initiating Composio connection:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to connect" },
      { status: 500 }
    );
  }
}
