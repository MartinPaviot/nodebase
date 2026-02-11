import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import type { IntegrationType } from "@prisma/client";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`
);

// Helper to determine integration type from scopes
function getIntegrationTypeFromScopes(scopes: string[]): IntegrationType | null {
  // Check specific services first (more specific scopes)
  if (scopes.some((s) => s.includes("gmail"))) return "GMAIL";
  if (scopes.some((s) => s.includes("spreadsheets"))) return "GOOGLE_SHEETS";
  if (scopes.some((s) => s.includes("documents"))) return "GOOGLE_DOCS";
  if (scopes.some((s) => s.includes("calendar"))) return "GOOGLE_CALENDAR";
  // Drive is most generic, check last
  if (scopes.some((s) => s.includes("/drive") && !s.includes("drive.file"))) return "GOOGLE_DRIVE";
  return null;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state"); // userId
  const scope = request.nextUrl.searchParams.get("scope");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/integrations?error=missing_params", request.url));
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // Determine type based on scopes
    const scopes = scope?.split(" ") || [];
    const integrationType = getIntegrationTypeFromScopes(scopes);

    if (integrationType) {
      await prisma.integration.upsert({
        where: { userId_type: { userId: state, type: integrationType } },
        create: {
          userId: state,
          type: integrationType,
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          accountEmail: userInfo.email,
          accountName: userInfo.name,
          scopes,
        },
        update: {
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token || undefined,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          scopes,
        },
      });
    }

    return NextResponse.redirect(new URL("/integrations?success=true", request.url));
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(new URL("/integrations?error=auth_failed", request.url));
  }
}
