import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state"); // userId

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/integrations?error=missing_params", request.url)
    );
  }

  try {
    // Exchange code for token
    const response = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(
          `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/notion/callback`,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error("Notion OAuth error:", data.error);
      throw new Error(data.error);
    }

    await prisma.integration.upsert({
      where: { userId_type: { userId: state, type: "NOTION" } },
      create: {
        userId: state,
        type: "NOTION",
        accessToken: data.access_token,
        accountName: data.workspace_name,
        accountEmail: data.owner?.user?.person?.email || null,
      },
      update: {
        accessToken: data.access_token,
        accountName: data.workspace_name,
      },
    });

    return NextResponse.redirect(
      new URL("/integrations?success=true", request.url)
    );
  } catch (error) {
    console.error("Notion OAuth error:", error);
    return NextResponse.redirect(
      new URL("/integrations?error=auth_failed", request.url)
    );
  }
}
