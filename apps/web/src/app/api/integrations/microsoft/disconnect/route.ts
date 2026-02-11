import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";
import type { IntegrationType } from "@/generated/prisma";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type } = await request.json() as { type: IntegrationType };

  // Validate it's a Microsoft integration type
  if (!["OUTLOOK", "OUTLOOK_CALENDAR", "MICROSOFT_TEAMS"].includes(type)) {
    return NextResponse.json({ error: "Invalid integration type" }, { status: 400 });
  }

  try {
    await prisma.integration.delete({
      where: {
        userId_type: {
          userId: session.user.id,
          type,
        },
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Disconnect integration error:", error);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
