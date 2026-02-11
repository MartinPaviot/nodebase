import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getGoogleAuthUrl } from "@/lib/integrations/google";

// Scope mappings for each Google integration type
const GOOGLE_SCOPES: Record<string, string[]> = {
  GMAIL: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/userinfo.email",
  ],
  GOOGLE_CALENDAR: [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/userinfo.email",
  ],
  GOOGLE_SHEETS: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/userinfo.email",
  ],
  GOOGLE_DRIVE: [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/userinfo.email",
  ],
  GOOGLE_DOCS: [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email",
  ],
};

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type } = await request.json();

  const scopes = GOOGLE_SCOPES[type];
  if (!scopes) {
    return NextResponse.json({ error: "Invalid integration type" }, { status: 400 });
  }

  const url = getGoogleAuthUrl(session.user.id, scopes);
  return NextResponse.json({ url });
}
