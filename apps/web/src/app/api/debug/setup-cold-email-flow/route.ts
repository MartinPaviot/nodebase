/**
 * DEBUG ENDPOINT - Setup Cold Email Campaign Flow
 *
 * Usage: GET /api/debug/setup-cold-email-flow?agentId=xxx
 *
 * Injects a complete workflow into the Cold Email Campaign agent
 */

import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";
import { NextResponse, NextRequest } from "next/server";

const COLD_EMAIL_FLOW_DATA = {
  nodes: [
    // 1. Trigger: Message Received
    {
      id: "trigger-1",
      type: "messageReceived",
      position: { x: 400, y: 50 },
      data: {
        label: "Message Received",
        description: "When a new campaign is triggered",
      },
    },

    // 2. Enrich Lead Data
    {
      id: "enrich-1",
      type: "peopleDataLabs",
      position: { x: 400, y: 200 },
      data: {
        label: "Enrich Lead",
        description: "Enrich lead with company data, title, LinkedIn",
        action: "enrich_person",
        outputVariable: "enrichedLead",
      },
    },

    // 3. Condition: Has enough data?
    {
      id: "condition-1",
      type: "condition",
      position: { x: 400, y: 370 },
      data: {
        label: "Has Enough Data?",
        description: "Check if we have enough info to personalize",
        conditions: [
          {
            id: "branch-yes",
            label: "Yes - Personalize",
            rule: "enrichedLead.company exists",
          },
          {
            id: "branch-no",
            label: "No - Generic",
            rule: "else",
          },
        ],
      },
    },

    // 4a. Generate Personalized Email (Yes branch)
    {
      id: "generate-personalized",
      type: "agentStep",
      position: { x: 250, y: 550 },
      data: {
        label: "Generate Personalized Email",
        description: "AI writes personalized cold email using lead context",
        prompt: `Write a cold email for {{enrichedLead.firstName}} at {{enrichedLead.company}}.

Context:
- Role: {{enrichedLead.title}}
- Industry: {{enrichedLead.industry}}
- Company size: {{enrichedLead.companySize}}

Follow the campaign directives and output JSON: {"subject": "...", "body": "..."}`,
        outputVariable: "emailDraft",
      },
    },

    // 4b. Generate Generic Email (No branch)
    {
      id: "generate-generic",
      type: "agentStep",
      position: { x: 600, y: 550 },
      data: {
        label: "Generate Generic Email",
        description: "AI writes email with minimal personalization",
        prompt: `Write a cold email for {{lead.firstName}} at {{lead.email}}.

We don't have much context, so keep it short and curiosity-driven.
Output JSON: {"subject": "...", "body": "..."}`,
        outputVariable: "emailDraft",
      },
    },

    // 5. Send Email via Gmail
    {
      id: "send-email",
      type: "sendEmail",
      position: { x: 400, y: 730 },
      data: {
        label: "Send via Gmail",
        description: "Send the generated email through connected Gmail",
        integration: "gmail",
        to: "{{lead.email}}",
        subject: "{{emailDraft.subject}}",
        body: "{{emailDraft.body}}",
        outputVariable: "sentEmail",
      },
    },

    // 6. Log to Google Sheets
    {
      id: "log-sheets",
      type: "googleSheets",
      position: { x: 400, y: 900 },
      data: {
        label: "Log to Spreadsheet",
        description: "Record sent email in campaign tracking sheet",
        action: "append_row",
        spreadsheetId: "",
        sheetName: "Campaign Log",
        values: [
          "{{lead.email}}",
          "{{lead.firstName}}",
          "{{emailDraft.subject}}",
          "{{sentEmail.messageId}}",
          "{{now}}",
          "sent",
        ],
      },
    },
  ],

  edges: [
    // Trigger → Enrich
    {
      id: "e-trigger-enrich",
      source: "trigger-1",
      target: "enrich-1",
    },
    // Enrich → Condition
    {
      id: "e-enrich-condition",
      source: "enrich-1",
      target: "condition-1",
    },
    // Condition (Yes) → Personalized
    {
      id: "e-condition-personalized",
      source: "condition-1",
      target: "generate-personalized",
      sourceHandle: "branch-yes",
    },
    // Condition (No) → Generic
    {
      id: "e-condition-generic",
      source: "condition-1",
      target: "generate-generic",
      sourceHandle: "branch-no",
    },
    // Personalized → Send Email
    {
      id: "e-personalized-send",
      source: "generate-personalized",
      target: "send-email",
    },
    // Generic → Send Email
    {
      id: "e-generic-send",
      source: "generate-generic",
      target: "send-email",
    },
    // Send Email → Log
    {
      id: "e-send-log",
      source: "send-email",
      target: "log-sheets",
    },
  ],
};

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get agentId from query params, or find Cold Email Campaign agent
    const agentId = request.nextUrl.searchParams.get("agentId");

    let agent;
    if (agentId) {
      agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { id: true, name: true, userId: true },
      });
    } else {
      // Try to find by name
      agent = await prisma.agent.findFirst({
        where: {
          userId,
          name: { contains: "Cold Email", mode: "insensitive" },
        },
        select: { id: true, name: true, userId: true },
      });
    }

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found. Pass ?agentId=xxx or create a Cold Email Campaign agent first." },
        { status: 404 }
      );
    }

    if (agent.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Save flowData to agent
    const updated = await prisma.agent.update({
      where: { id: agent.id },
      data: {
        flowData: COLD_EMAIL_FLOW_DATA as never,
      },
      select: {
        id: true,
        name: true,
        flowData: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Flow data injected into "${agent.name}"!`,
      agent: {
        id: updated.id,
        name: updated.name,
        nodesCount: COLD_EMAIL_FLOW_DATA.nodes.length,
        edgesCount: COLD_EMAIL_FLOW_DATA.edges.length,
      },
      nextStep: `Go to /agents/${agent.id}/flow to see the workflow`,
    });
  } catch (error) {
    console.error("Error setting up flow:", error);
    return NextResponse.json(
      { error: "Failed to setup flow", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
