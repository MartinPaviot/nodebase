import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/campaign/unsubscribe";

/**
 * GET /api/unsubscribe/[token]
 *
 * RFC 8058 one-click unsubscribe endpoint.
 * Verifies the signed token, marks the lead as UNSUBSCRIBED,
 * and returns a confirmation page.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const emailId = verifyUnsubscribeToken(token);
  if (!emailId) {
    return new NextResponse(
      renderPage("Invalid or expired link", "This unsubscribe link is no longer valid."),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  try {
    // Find the campaign email
    const campaignEmail = await prisma.campaignEmail.findUnique({
      where: { id: emailId },
      include: { lead: true },
    });

    if (!campaignEmail) {
      return new NextResponse(
        renderPage("Not found", "This email record was not found."),
        { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // Check if already unsubscribed
    if (campaignEmail.lead.unsubscribedAt) {
      return new NextResponse(
        renderPage("Already unsubscribed", "You have already been unsubscribed. You will not receive further emails."),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // Mark lead as unsubscribed
    await prisma.lead.update({
      where: { id: campaignEmail.leadId },
      data: {
        status: "UNSUBSCRIBED",
        unsubscribedAt: new Date(),
        nextSendAt: null,
      },
    });

    return new NextResponse(
      renderPage(
        "Unsubscribed",
        "You have been successfully unsubscribed. You will not receive further emails from us."
      ),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return new NextResponse(
      renderPage("Error", "An error occurred. Please try again later."),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

/**
 * POST /api/unsubscribe/[token]
 *
 * RFC 8058 List-Unsubscribe-Post handler.
 * Email clients (Gmail, Outlook) send a POST for one-click unsubscribe.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const emailId = verifyUnsubscribeToken(token);
  if (!emailId) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  try {
    const campaignEmail = await prisma.campaignEmail.findUnique({
      where: { id: emailId },
    });

    if (!campaignEmail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.lead.update({
      where: { id: campaignEmail.leadId },
      data: {
        status: "UNSUBSCRIBED",
        unsubscribedAt: new Date(),
        nextSendAt: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unsubscribe POST error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function renderPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f9fafb; color: #111827; }
    .card { background: white; border-radius: 12px; padding: 48px; max-width: 480px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { font-size: 24px; margin: 0 0 12px; }
    p { font-size: 16px; color: #6b7280; margin: 0; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
