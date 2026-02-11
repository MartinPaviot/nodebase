import { NextRequest, NextResponse } from "next/server";
import { getComposio } from "@/lib/composio-server";
import { getComposioAppName } from "@/lib/composio-app-names";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    const composio = getComposio();

    const apps = search
      ? await composio.searchApps(search)
      : await composio.getApps();

    // Format app names using official branding
    const formattedApps = apps.map((app) => ({
      ...app,
      name: getComposioAppName(app.name),
    }));

    return NextResponse.json({ data: formattedApps });
  } catch (error) {
    console.error("Error fetching Composio apps:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch apps" },
      { status: 500 }
    );
  }
}
