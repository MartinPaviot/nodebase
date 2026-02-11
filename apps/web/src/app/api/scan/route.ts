/**
 * Scan API Route
 *
 * POST /api/scan
 * Executes a scan for a specific category to detect signals.
 */

import { NextRequest, NextResponse } from "next/server";
import { getScanEngine } from "@/lib/nodebase";
import { z } from "zod";
import type { ScanCategory } from "@nodebase/types";

// ============================================
// Request Schema
// ============================================

const ScanRequestSchema = z.object({
  category: z.enum([
    "SALES",
    "SUPPORT",
    "MARKETING",
    "HR",
    "FINANCE",
    "PROJECTS",
  ]),
  workspaceId: z.string(),
  credentials: z
    .record(z.string(), z.object({ accessToken: z.string() }))
    .optional(),
});

// ============================================
// POST /api/scan
// ============================================

export async function POST(req: NextRequest) {
  try {
    // Parse and validate request body
    const body = await req.json();
    const validatedData = ScanRequestSchema.parse(body);

    // Get scan engine
    const scanEngine = await getScanEngine();

    // Prepare credentials map
    const credentials = new Map(
      Object.entries(validatedData.credentials || {})
    );

    // Execute scan
    const result = await scanEngine.scan(
      validatedData.category as ScanCategory,
      {
        workspaceId: validatedData.workspaceId,
        credentials,
      }
    );

    // Return results
    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        category: result.category,
        workspaceId: result.workspaceId,
        scannedAt: result.scannedAt.toISOString(),
        signalsCount: result.signals.length,
        signals: result.signals.map((signal) => ({
          id: signal.id,
          type: signal.type,
          severity: signal.severity,
          title: signal.title,
          description: signal.description,
          metadata: signal.metadata,
          connectorId: signal.connectorId,
          detectedAt: signal.detectedAt.toISOString(),
        })),
        criticalCount: result.signals.filter(
          (s) => s.severity === "critical" || s.severity === "high"
        ).length,
      },
    });
  } catch (error) {
    console.error("[API /scan] Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Scan failed",
      },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/scan (list available categories)
// ============================================

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      categories: [
        {
          id: "SALES",
          name: "Sales",
          description: "Detect dormant deals, stale leads, and lost opportunities",
          icon: "💼",
        },
        {
          id: "SUPPORT",
          name: "Support",
          description: "Monitor SLA warnings, unassigned tickets, and overdue follow-ups",
          icon: "🎧",
        },
        {
          id: "MARKETING",
          name: "Marketing",
          description: "Track campaign performance, email bounces, and engagement",
          icon: "📊",
        },
        {
          id: "HR",
          name: "HR",
          description: "Manage applications, candidate follow-ups, and onboarding",
          icon: "👥",
        },
        {
          id: "FINANCE",
          name: "Finance",
          description: "Monitor overdue invoices, payment failures, and budgets",
          icon: "💰",
        },
        {
          id: "PROJECTS",
          name: "Projects",
          description: "Track blocked tasks, missed deadlines, and assignments",
          icon: "📋",
        },
      ],
    },
  });
}
