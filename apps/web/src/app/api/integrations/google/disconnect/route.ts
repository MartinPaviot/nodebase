import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { deleteIntegration } from "@/lib/integrations/google";
import type { IntegrationType } from "@prisma/client";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type } = await request.json() as { type: IntegrationType };

  try {
    await deleteIntegration(session.user.id, type);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Disconnect integration error:", error);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
