import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { getInstantlyClient } from "@/lib/instantly/client";
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

// Parse state: either plain userId (legacy) or JSON { userId, type, returnUrl }
function parseState(state: string): { userId: string; type?: string; returnUrl?: string } {
  try {
    const parsed = JSON.parse(state);
    if (parsed && typeof parsed.userId === "string") return parsed;
  } catch {
    // Not JSON — treat as plain userId (backward compatible)
  }
  return { userId: state };
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateParam = request.nextUrl.searchParams.get("state");
  const scope = request.nextUrl.searchParams.get("scope");

  if (!code || !stateParam) {
    return NextResponse.redirect(new URL("/integrations?error=missing_params", request.url));
  }

  const { userId, type: stateType, returnUrl } = parseState(stateParam);

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // ── Mailbox flow: store in MailboxAccount with encrypted tokens ──
    if (stateType === "GMAIL_MAILBOX") {
      const email = userInfo.email;
      if (!email) {
        return NextResponse.redirect(
          new URL("/settings/mailboxes?error=no_email", request.url)
        );
      }

      const displayName = userInfo.name || email;
      const domain = email.split("@")[1];

      const encryptedAccessToken = encrypt(tokens.access_token!);
      const encryptedRefreshToken = tokens.refresh_token
        ? encrypt(tokens.refresh_token)
        : "";
      const tokenExpiresAt = tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : null;

      const mailbox = await prisma.mailboxAccount.upsert({
        where: { userId_email: { userId, email } },
        create: {
          userId,
          email,
          displayName,
          domain,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt,
          status: "CONNECTING",
        },
        update: {
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt,
          displayName,
          status: "CONNECTING",
        },
      });

      // Register with Instantly for warmup (non-blocking)
      try {
        const instantly = getInstantlyClient();
        const account = await instantly.addAccount(email);
        await instantly.enableWarmup(account.id);

        await prisma.mailboxAccount.update({
          where: { id: mailbox.id },
          data: {
            instantlyAccountId: account.id,
            instantlyWarmupEnabled: true,
            status: "WARMING",
          },
        });
      } catch (e) {
        console.error("Instantly registration failed:", e);
      }

      return NextResponse.redirect(
        new URL("/settings/mailboxes?added=true", request.url)
      );
    }

    // ── Standard integration flow ──
    const scopes = scope?.split(" ") || [];
    const integrationType = getIntegrationTypeFromScopes(scopes);

    if (integrationType) {
      await prisma.integration.upsert({
        where: { userId_type: { userId, type: integrationType } },
        create: {
          userId,
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

    const successRedirect = returnUrl
      ? `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}integration_success=true`
      : "/integrations?success=true";
    return NextResponse.redirect(new URL(successRedirect, request.url));
  } catch (error) {
    console.error("OAuth callback error:", error);
    // Redirect based on the flow that failed
    const errorRedirect = stateType === "GMAIL_MAILBOX"
      ? "/settings/mailboxes?error=auth_failed"
      : returnUrl
        ? `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}integration_error=auth_failed`
        : "/integrations?error=auth_failed";
    return NextResponse.redirect(new URL(errorRedirect, request.url));
  }
}
