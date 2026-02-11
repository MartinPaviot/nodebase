import { google } from "googleapis";
import prisma from "../db";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`
);

export function getGoogleAuthUrl(userId: string, scopes: string[]) {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    state: userId,
    prompt: "consent",
  });
}

export type GoogleIntegrationType = "GMAIL" | "GOOGLE_CALENDAR" | "GOOGLE_SHEETS" | "GOOGLE_DRIVE" | "GOOGLE_DOCS";

export async function getGoogleClient(userId: string, type: GoogleIntegrationType) {
  const integration = await prisma.integration.findUnique({
    where: { userId_type: { userId, type } },
  });

  if (!integration) throw new Error(`${type} not connected`);

  oauth2Client.setCredentials({
    access_token: integration.accessToken,
    refresh_token: integration.refreshToken,
  });

  // Refresh if expired
  if (integration.expiresAt && integration.expiresAt < new Date()) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        accessToken: credentials.access_token!,
        expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      },
    });
    oauth2Client.setCredentials(credentials);
  }

  return oauth2Client;
}

// Gmail functions
export async function sendEmail(userId: string, to: string, subject: string, body: string) {
  const auth = await getGoogleClient(userId, "GMAIL");
  const gmail = google.gmail({ version: "v1", auth });

  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "",
    body,
  ].join("\n");

  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodedMessage },
  });
}

export async function listEmails(userId: string, maxResults = 10, query?: string) {
  const auth = await getGoogleClient(userId, "GMAIL");
  const gmail = google.gmail({ version: "v1", auth });

  const response = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    q: query,
  });

  const messages = await Promise.all(
    (response.data.messages || []).map(async (msg) => {
      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["From", "To", "Subject", "Date"],
      });
      return {
        id: msg.id,
        snippet: full.data.snippet,
        headers: full.data.payload?.headers,
      };
    })
  );

  return messages;
}

export async function searchEmails(userId: string, query: string, maxResults = 10) {
  return listEmails(userId, maxResults, query);
}

// Calendar functions
export async function listEvents(userId: string, timeMin?: Date, timeMax?: Date) {
  const auth = await getGoogleClient(userId, "GOOGLE_CALENDAR");
  const calendar = google.calendar({ version: "v3", auth });

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: (timeMin || new Date()).toISOString(),
    timeMax: timeMax?.toISOString(),
    maxResults: 20,
    singleEvents: true,
    orderBy: "startTime",
  });

  return response.data.items;
}

export async function createEvent(userId: string, event: {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  attendees?: string[];
}) {
  const auth = await getGoogleClient(userId, "GOOGLE_CALENDAR");
  const calendar = google.calendar({ version: "v3", auth });

  return calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.start.toISOString() },
      end: { dateTime: event.end.toISOString() },
      attendees: event.attendees?.map((email) => ({ email })),
    },
  });
}

// Google Sheets functions
export async function appendToSheet(
  userId: string,
  spreadsheetId: string,
  range: string,
  values: string[][]
) {
  const auth = await getGoogleClient(userId, "GOOGLE_SHEETS");
  const sheets = google.sheets({ version: "v4", auth });

  return sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

export async function readSheet(
  userId: string,
  spreadsheetId: string,
  range: string
) {
  const auth = await getGoogleClient(userId, "GOOGLE_SHEETS");
  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return response.data.values;
}

export async function updateSheet(
  userId: string,
  spreadsheetId: string,
  range: string,
  values: string[][]
) {
  const auth = await getGoogleClient(userId, "GOOGLE_SHEETS");
  const sheets = google.sheets({ version: "v4", auth });

  return sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

export async function createSpreadsheet(userId: string, title: string) {
  const auth = await getGoogleClient(userId, "GOOGLE_SHEETS");
  const sheets = google.sheets({ version: "v4", auth });

  return sheets.spreadsheets.create({
    requestBody: { properties: { title } },
  });
}

// Google Drive functions
export async function listDriveFiles(
  userId: string,
  options: { pageSize?: number; query?: string } = {}
) {
  const auth = await getGoogleClient(userId, "GOOGLE_DRIVE");
  const drive = google.drive({ version: "v3", auth });

  return drive.files.list({
    pageSize: options.pageSize || 20,
    q: options.query,
    fields: "files(id, name, mimeType, webViewLink, createdTime, modifiedTime)",
  });
}

export async function getDriveFile(userId: string, fileId: string) {
  const auth = await getGoogleClient(userId, "GOOGLE_DRIVE");
  const drive = google.drive({ version: "v3", auth });

  return drive.files.get({
    fileId,
    fields: "id, name, mimeType, webViewLink, createdTime, modifiedTime",
  });
}

export async function uploadDriveFile(
  userId: string,
  name: string,
  mimeType: string,
  content: string | Buffer
) {
  const auth = await getGoogleClient(userId, "GOOGLE_DRIVE");
  const drive = google.drive({ version: "v3", auth });
  const { Readable } = await import("stream");

  const media = {
    mimeType,
    body: Readable.from(typeof content === "string" ? Buffer.from(content) : content),
  };

  return drive.files.create({
    requestBody: { name, mimeType },
    media,
    fields: "id, name, webViewLink",
  });
}

export async function deleteDriveFile(userId: string, fileId: string) {
  const auth = await getGoogleClient(userId, "GOOGLE_DRIVE");
  const drive = google.drive({ version: "v3", auth });

  return drive.files.delete({ fileId });
}

// Google Docs functions
export async function createDoc(userId: string, title: string) {
  const auth = await getGoogleClient(userId, "GOOGLE_DOCS");
  const docs = google.docs({ version: "v1", auth });

  return docs.documents.create({
    requestBody: { title },
  });
}

export async function getDoc(userId: string, documentId: string) {
  const auth = await getGoogleClient(userId, "GOOGLE_DOCS");
  const docs = google.docs({ version: "v1", auth });

  return docs.documents.get({ documentId });
}

export async function appendToDoc(
  userId: string,
  documentId: string,
  text: string
) {
  const auth = await getGoogleClient(userId, "GOOGLE_DOCS");
  const docs = google.docs({ version: "v1", auth });

  // First get the doc to find the end index
  const doc = await docs.documents.get({ documentId });
  const endIndex = doc.data.body?.content?.slice(-1)[0]?.endIndex || 1;

  return docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: endIndex - 1 },
            text,
          },
        },
      ],
    },
  });
}

// Check if user has integration
export async function hasIntegration(userId: string, type: GoogleIntegrationType | "SLACK" | "NOTION" | "OUTLOOK" | "OUTLOOK_CALENDAR" | "MICROSOFT_TEAMS") {
  const integration = await prisma.integration.findUnique({
    where: { userId_type: { userId, type } },
  });
  return !!integration;
}

// Get user integrations
export async function getUserIntegrations(userId: string) {
  return prisma.integration.findMany({
    where: { userId },
  });
}

// Delete integration
export async function deleteIntegration(userId: string, type: GoogleIntegrationType | "SLACK" | "NOTION" | "OUTLOOK" | "OUTLOOK_CALENDAR" | "MICROSOFT_TEAMS") {
  return prisma.integration.delete({
    where: { userId_type: { userId, type } },
  });
}
