import { NextRequest, NextResponse } from "next/server";
import {
  exchangeSlackCode,
  saveSlackIntegration,
} from "@/lib/integrations/slack";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state"); // userId
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    console.error("Slack OAuth error:", error);
    return NextResponse.redirect(
      new URL("/integrations?error=access_denied", request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/integrations?error=missing_params", request.url)
    );
  }

  try {
    // Exchange code for token
    const tokenData = await exchangeSlackCode(code);

    // Save integration
    await saveSlackIntegration(state, tokenData);

    return NextResponse.redirect(
      new URL("/integrations?success=slack", request.url)
    );
  } catch (error) {
    console.error("Slack OAuth error:", error);
    return NextResponse.redirect(
      new URL("/integrations?error=auth_failed", request.url)
    );
  }
}
