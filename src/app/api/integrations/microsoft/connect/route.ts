import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getMicrosoftAuthUrlAsync, MICROSOFT_SCOPES } from "@/lib/integrations/microsoft";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type } = await request.json();

  // Validate integration type
  if (!MICROSOFT_SCOPES[type]) {
    return NextResponse.json({ error: "Invalid integration type" }, { status: 400 });
  }

  try {
    const url = await getMicrosoftAuthUrlAsync(session.user.id, type);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Microsoft OAuth URL error:", error);
    return NextResponse.json({ error: "Failed to generate auth URL" }, { status: 500 });
  }
}
