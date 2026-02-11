import { NextResponse } from "next/server";
import { getComposio } from "@/lib/composio-server";

/**
 * TEMPORARY TEST ENDPOINT
 * Visit /api/test-composio-names to see how Composio formats app names
 */
export async function GET() {
  try {
    const composio = getComposio();
    const apps = await composio.getApps();

    // Get sample of apps to see naming patterns
    const samples = apps.slice(0, 50).map((app) => ({
      key: app.key,
      name: app.name,
      description: app.description?.substring(0, 100),
    }));

    // Find specific apps we're interested in
    const specificApps: Record<string, any> = {};
    const searchFor = [
      "people",
      "hubspot",
      "google",
      "microsoft",
      "salesforce",
      "slack",
      "github",
      "notion",
      "stripe",
      "zendesk",
      "linkedin",
    ];

    searchFor.forEach((keyword) => {
      const found = apps.filter((app) =>
        app.key?.toLowerCase().includes(keyword) ||
        app.name?.toLowerCase().includes(keyword)
      );
      if (found.length > 0) {
        specificApps[keyword] = found.map((app) => ({
          key: app.key,
          name: app.name,
        }));
      }
    });

    return NextResponse.json({
      totalApps: apps.length,
      samples,
      specificApps,
    }, { status: 200 });
  } catch (error) {
    console.error("Error testing Composio:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to test Composio",
      },
      { status: 500 }
    );
  }
}
