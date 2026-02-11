/**
 * Google Calendar Connector
 *
 * Calendar connector for Google Calendar API.
 */

import { z } from "zod";
import { BaseConnector, type ConnectorContext, type ActionResult } from "../base";

// ============================================
// Schemas
// ============================================

const EventSchema = z.object({
  id: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  start: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
    timeZone: z.string().optional(),
  }),
  end: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
    timeZone: z.string().optional(),
  }),
  attendees: z
    .array(
      z.object({
        email: z.string(),
        responseStatus: z.string().optional(),
      })
    )
    .optional(),
  htmlLink: z.string().optional(),
});

const CreateEventInput = z.object({
  calendarId: z.string().optional(),
  summary: z.string(),
  description: z.string().optional(),
  startDateTime: z.string(),
  endDateTime: z.string(),
  timeZone: z.string().optional(),
  attendees: z.array(z.string().email()).optional(),
  sendUpdates: z.enum(["all", "externalOnly", "none"]).optional(),
});

const ListEventsInput = z.object({
  calendarId: z.string().optional(),
  timeMin: z.string().optional(),
  timeMax: z.string().optional(),
  maxResults: z.number().optional(),
  singleEvents: z.boolean().optional(),
  orderBy: z.enum(["startTime", "updated"]).optional(),
});

const GetFreeBusyInput = z.object({
  calendarIds: z.array(z.string()),
  timeMin: z.string(),
  timeMax: z.string(),
});

const UpdateEventInput = z.object({
  calendarId: z.string().optional(),
  eventId: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  startDateTime: z.string().optional(),
  endDateTime: z.string().optional(),
});

const DeleteEventInput = z.object({
  calendarId: z.string().optional(),
  eventId: z.string(),
  sendUpdates: z.enum(["all", "externalOnly", "none"]).optional(),
});

// ============================================
// Connector Implementation
// ============================================

export class CalendarConnector extends BaseConnector {
  readonly id = "google-calendar";
  readonly name = "Google Calendar";
  readonly description = "Google calendar and scheduling";
  readonly category = "CALENDAR" as const;
  readonly icon = "logos:google-calendar";
  readonly pipedreamAppSlug = "google_calendar";

  readonly requiredScopes = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
  ];

  readonly optionalScopes = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.freebusy",
  ];

  constructor() {
    super();
    this.registerActions();
  }

  private registerActions(): void {
    // Create Event
    this.registerAction({
      id: "create-event",
      name: "Create Event",
      description: "Create a calendar event",
      inputSchema: CreateEventInput,
      outputSchema: EventSchema,
      execute: async (input, context) => {
        return this.createEvent(input, context);
      },
    });

    // List Events
    this.registerAction({
      id: "list-events",
      name: "List Events",
      description: "List calendar events",
      inputSchema: ListEventsInput,
      outputSchema: z.array(EventSchema),
      execute: async (input, context) => {
        return this.listEvents(input, context);
      },
    });

    // Get Free/Busy
    this.registerAction({
      id: "get-freebusy",
      name: "Get Free/Busy",
      description: "Check availability for calendars",
      inputSchema: GetFreeBusyInput,
      outputSchema: z.record(
        z.array(z.object({ start: z.string(), end: z.string() }))
      ),
      execute: async (input, context) => {
        return this.getFreeBusy(input, context);
      },
    });

    // Update Event
    this.registerAction({
      id: "update-event",
      name: "Update Event",
      description: "Update a calendar event",
      inputSchema: UpdateEventInput,
      outputSchema: EventSchema,
      execute: async (input, context) => {
        return this.updateEvent(input, context);
      },
    });

    // Delete Event
    this.registerAction({
      id: "delete-event",
      name: "Delete Event",
      description: "Delete a calendar event",
      inputSchema: DeleteEventInput,
      outputSchema: z.object({ success: z.boolean() }),
      execute: async (input, context) => {
        return this.deleteEvent(input, context);
      },
    });
  }

  // ============================================
  // Action Implementations
  // ============================================

  private async createEvent(
    input: z.infer<typeof CreateEventInput>,
    context: ConnectorContext
  ): Promise<ActionResult<z.infer<typeof EventSchema>>> {
    const event = {
      summary: input.summary,
      description: input.description,
      start: {
        dateTime: input.startDateTime,
        timeZone: input.timeZone ?? "UTC",
      },
      end: {
        dateTime: input.endDateTime,
        timeZone: input.timeZone ?? "UTC",
      },
      attendees: input.attendees?.map((email) => ({ email })),
    };

    const response = await this.apiRequest<z.infer<typeof EventSchema>>(
      context,
      "POST",
      `/calendar/v3/calendars/${encodeURIComponent(input.calendarId ?? "primary")}/events?sendUpdates=${input.sendUpdates ?? "all"}`,
      event
    );

    return response;
  }

  private async listEvents(
    input: z.infer<typeof ListEventsInput>,
    context: ConnectorContext
  ): Promise<ActionResult<z.infer<typeof EventSchema>[]>> {
    const params = new URLSearchParams({
      maxResults: String(input.maxResults ?? 10),
      singleEvents: String(input.singleEvents ?? true),
      orderBy: input.orderBy ?? "startTime",
    });

    if (input.timeMin) params.set("timeMin", input.timeMin);
    if (input.timeMax) params.set("timeMax", input.timeMax);

    const response = await this.apiRequest<{
      items: z.infer<typeof EventSchema>[];
    }>(
      context,
      "GET",
      `/calendar/v3/calendars/${encodeURIComponent(input.calendarId ?? "primary")}/events?${params.toString()}`
    );

    if (!response.success) {
      return response as any;
    }

    return { success: true, data: response.data?.items ?? [] };
  }

  private async getFreeBusy(
    input: z.infer<typeof GetFreeBusyInput>,
    context: ConnectorContext
  ): Promise<
    ActionResult<Record<string, { start: string; end: string }[]>>
  > {
    const response = await this.apiRequest<{
      calendars: Record<string, { busy: { start: string; end: string }[] }>;
    }>(context, "POST", "/calendar/v3/freeBusy", {
      timeMin: input.timeMin,
      timeMax: input.timeMax,
      items: input.calendarIds.map((id) => ({ id })),
    });

    if (!response.success || !response.data?.calendars) {
      return response as any;
    }

    const result: Record<string, { start: string; end: string }[]> = {};
    for (const [calId, data] of Object.entries(response.data.calendars)) {
      result[calId] = data.busy;
    }

    return { success: true, data: result };
  }

  private async updateEvent(
    input: z.infer<typeof UpdateEventInput>,
    context: ConnectorContext
  ): Promise<ActionResult<z.infer<typeof EventSchema>>> {
    const updates: Record<string, unknown> = {};
    if (input.summary) updates.summary = input.summary;
    if (input.description) updates.description = input.description;
    if (input.startDateTime) updates.start = { dateTime: input.startDateTime };
    if (input.endDateTime) updates.end = { dateTime: input.endDateTime };

    const response = await this.apiRequest<z.infer<typeof EventSchema>>(
      context,
      "PATCH",
      `/calendar/v3/calendars/${encodeURIComponent(input.calendarId ?? "primary")}/events/${input.eventId}`,
      updates
    );

    return response;
  }

  private async deleteEvent(
    input: z.infer<typeof DeleteEventInput>,
    context: ConnectorContext
  ): Promise<ActionResult<{ success: boolean }>> {
    const response = await this.apiRequest<void>(
      context,
      "DELETE",
      `/calendar/v3/calendars/${encodeURIComponent(input.calendarId ?? "primary")}/events/${input.eventId}?sendUpdates=${input.sendUpdates ?? "all"}`
    );

    return { success: response.success, data: { success: response.success } };
  }

  // ============================================
  // OAuth Methods
  // ============================================

  async testConnection(context: ConnectorContext): Promise<ActionResult<boolean>> {
    const result = await this.apiRequest(
      context,
      "GET",
      "/calendar/v3/users/me/calendarList?maxResults=1"
    );
    return { success: result.success, data: result.success };
  }

  getOAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: this.requiredScopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeOAuthCode(
    code: string,
    redirectUri: string
  ): Promise<ActionResult<{ accessToken: string; refreshToken?: string; expiresAt?: Date }>> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!response.ok) {
      return { success: false, error: "Failed to exchange OAuth code" };
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    return {
      success: true,
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      },
    };
  }

  async refreshAccessToken(
    refreshToken: string
  ): Promise<ActionResult<{ accessToken: string; refreshToken?: string; expiresAt?: Date }>> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      return { success: false, error: "Failed to refresh token" };
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    return {
      success: true,
      data: {
        accessToken: data.access_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      },
    };
  }

  // ============================================
  // API Helper
  // ============================================

  private async apiRequest<T>(
    context: ConnectorContext,
    method: string,
    path: string,
    body?: unknown
  ): Promise<ActionResult<T>> {
    const url = `https://www.googleapis.com${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    // DELETE returns no body
    if (method === "DELETE") {
      return { success: true, data: undefined as T };
    }

    const data = (await response.json()) as T;
    return { success: true, data };
  }
}
