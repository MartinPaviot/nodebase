import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { MICROSOFT_SCOPES } from "@/lib/integrations/microsoft";
import type { IntegrationType } from "@/generated/prisma";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state"); // userId:integrationType
  const error = request.nextUrl.searchParams.get("error");
  const errorDescription = request.nextUrl.searchParams.get("error_description");

  if (error) {
    console.error("Microsoft OAuth error:", error, errorDescription);
    return NextResponse.redirect(
      new URL(`/integrations?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/integrations?error=missing_params", request.url)
    );
  }

  const [userId, integrationType] = state.split(":");

  if (!userId || !integrationType || !MICROSOFT_SCOPES[integrationType]) {
    return NextResponse.redirect(
      new URL("/integrations?error=invalid_state", request.url)
    );
  }

  const scopes = MICROSOFT_SCOPES[integrationType];
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/microsoft/callback`;

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          scope: scopes.join(" "),
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("Microsoft token error:", tokenData);
      return NextResponse.redirect(
        new URL(`/integrations?error=${encodeURIComponent(tokenData.error)}`, request.url)
      );
    }

    // Get user profile from Microsoft Graph
    const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const profileData = await profileResponse.json();

    // Save/update integration in database
    await prisma.integration.upsert({
      where: {
        userId_type: {
          userId,
          type: integrationType as IntegrationType,
        },
      },
      create: {
        userId,
        type: integrationType as IntegrationType,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : null,
        accountEmail: profileData.mail || profileData.userPrincipalName,
        accountName: profileData.displayName,
        scopes,
      },
      update: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || undefined,
        expiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : null,
        scopes,
      },
    });

    return NextResponse.redirect(
      new URL("/integrations?success=true", request.url)
    );
  } catch (err) {
    console.error("Microsoft OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/integrations?error=auth_failed", request.url)
    );
  }
}
