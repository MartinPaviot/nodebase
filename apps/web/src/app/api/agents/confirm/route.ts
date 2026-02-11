import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { ActivityType, Prisma } from "@prisma/client";
import {
  sendEmail,
  createEvent,
} from "@/lib/integrations/google";
import {
  sendSlackMessage,
} from "@/lib/integrations/slack";
import {
  createNotionPage,
  appendToNotionPage,
} from "@/lib/integrations/notion";

// Map action types to their execution functions
type ActionExecutor = (
  userId: string,
  args: Record<string, unknown>
) => Promise<Record<string, unknown>>;

const actionExecutors: Record<string, ActionExecutor> = {
  send_email: async (userId, args) => {
    const result = await sendEmail(
      userId,
      args.to as string,
      args.subject as string,
      args.body as string
    );
    return {
      success: true,
      messageId: result.data.id,
      message: `Email sent successfully to ${args.to}`,
    };
  },
  create_calendar_event: async (userId, args) => {
    const result = await createEvent(userId, {
      summary: args.summary as string,
      description: args.description as string | undefined,
      start: new Date(args.startDateTime as string),
      end: new Date(args.endDateTime as string),
      attendees: args.attendees as string[] | undefined,
    });
    return {
      success: true,
      eventId: result.data.id,
      htmlLink: result.data.htmlLink,
      message: `Calendar event "${args.summary}" created successfully`,
    };
  },
  send_slack_message: async (userId, args) => {
    const result = await sendSlackMessage(
      userId,
      args.channel as string,
      args.text as string
    );
    return {
      success: true,
      messageTs: result.ts,
      channel: result.channel,
      message: `Message sent successfully to channel`,
    };
  },
  create_notion_page: async (userId, args) => {
    const page = await createNotionPage(userId, {
      title: args.title as string,
      content: args.content as string,
      parentPageId: args.parentPageId as string | undefined,
      databaseId: args.databaseId as string | undefined,
    });
    return {
      success: true,
      id: page.id,
      url: page.url,
      title: page.title,
      message: `Created page "${args.title}" successfully`,
    };
  },
  append_to_notion: async (userId, args) => {
    const result = await appendToNotionPage(
      userId,
      args.pageId as string,
      args.content as string
    );
    return {
      success: true,
      blocksAdded: result.blocksAdded,
      message: `Appended ${result.blocksAdded} blocks to the page`,
    };
  },
};

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { activityId, confirmed } = await request.json();

    if (!activityId || typeof confirmed !== "boolean") {
      return NextResponse.json(
        { error: "Missing activityId or confirmed" },
        { status: 400 }
      );
    }

    // Find the activity
    const activity = await prisma.conversationActivity.findUnique({
      where: { id: activityId },
      include: {
        conversation: {
          include: {
            agent: true,
          },
        },
      },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    // Verify ownership
    if (activity.conversation.agent.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check if activity requires confirmation
    if (!activity.requiresConfirmation) {
      return NextResponse.json(
        { error: "Activity does not require confirmation" },
        { status: 400 }
      );
    }

    // Check if already processed
    if (activity.confirmedAt || activity.rejectedAt) {
      return NextResponse.json(
        { error: "Activity already processed" },
        { status: 400 }
      );
    }

    // Get the action details
    const details = activity.details as {
      actionType: string;
      actionArgs: Record<string, unknown>;
    } | null;

    if (!details || !details.actionType || !details.actionArgs) {
      return NextResponse.json(
        { error: "Invalid activity details" },
        { status: 400 }
      );
    }

    if (confirmed) {
      // Execute the action
      const executor = actionExecutors[details.actionType];
      if (!executor) {
        return NextResponse.json(
          { error: `Unknown action type: ${details.actionType}` },
          { status: 400 }
        );
      }

      try {
        const result = await executor(session.user.id, details.actionArgs);

        // Update activity with confirmation
        await prisma.conversationActivity.update({
          where: { id: activityId },
          data: { confirmedAt: new Date() },
        });

        // Create a new activity for the completed action
        await prisma.conversationActivity.create({
          data: {
            conversationId: activity.conversationId,
            type: ActivityType.CONFIRMATION_APPROVED,
            title: `${activity.title} - Confirmed`,
            details: {
              actionType: details.actionType,
              result,
            } as Prisma.InputJsonValue,
          },
        });

        return NextResponse.json({
          success: true,
          executed: true,
          result,
        });
      } catch (error) {
        console.error("Action execution error:", error);

        // Update activity with rejection due to error
        await prisma.conversationActivity.update({
          where: { id: activityId },
          data: { rejectedAt: new Date() },
        });

        // Create error activity
        await prisma.conversationActivity.create({
          data: {
            conversationId: activity.conversationId,
            type: ActivityType.ERROR_OCCURRED,
            title: `${activity.title} - Failed`,
            details: {
              actionType: details.actionType,
              error: error instanceof Error ? error.message : "Action execution failed",
            } as Prisma.InputJsonValue,
          },
        });

        return NextResponse.json(
          {
            success: false,
            executed: false,
            error: error instanceof Error ? error.message : "Action execution failed",
          },
          { status: 500 }
        );
      }
    } else {
      // Mark as rejected
      await prisma.conversationActivity.update({
        where: { id: activityId },
        data: { rejectedAt: new Date() },
      });

      // Create rejection activity
      await prisma.conversationActivity.create({
        data: {
          conversationId: activity.conversationId,
          type: ActivityType.CONFIRMATION_REJECTED,
          title: `${activity.title} - Rejected`,
          details: {
            actionType: details.actionType,
          } as Prisma.InputJsonValue,
        },
      });

      return NextResponse.json({
        success: true,
        executed: false,
        message: "Action rejected",
      });
    }
  } catch (error) {
    console.error("Confirm action error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
