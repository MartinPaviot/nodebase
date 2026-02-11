import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getNotionAuthUrl } from "@/lib/integrations/notion";

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = getNotionAuthUrl(session.user.id);
  return NextResponse.json({ url });
}
