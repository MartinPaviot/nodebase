import prisma from "../db";
import { decrypt, encrypt } from "../encryption";

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const SLACK_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/slack/callback`;

export function getSlackAuthUrl(userId: string) {
  const scopes = [
    "chat:write",
    "channels:read",
    "channels:history",
    "users:read",
    "app_mentions:read",
  ].join(",");

  return `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(SLACK_REDIRECT_URI)}&state=${userId}`;
}

export async function getSlackClient(userId: string) {
  const integration = await prisma.integration.findUnique({
    where: { userId_type: { userId, type: "SLACK" } },
  });

  if (!integration) throw new Error("Slack not connected");
  return decrypt(integration.accessToken);
}

export async function sendSlackMessage(
  userId: string,
  channel: string,
  text: string,
  blocks?: unknown[]
) {
  const token = await getSlackClient(userId);

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel,
      text,
      blocks,
    }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  return data;
}

export async function listSlackChannels(userId: string) {
  const token = await getSlackClient(userId);

  const response = await fetch(
    "https://slack.com/api/conversations.list?types=public_channel,private_channel",
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  return data.channels as Array<{
    id: string;
    name: string;
    is_private: boolean;
    num_members: number;
  }>;
}

export async function getSlackChannelHistory(
  userId: string,
  channel: string,
  limit = 10
) {
  const token = await getSlackClient(userId);

  const response = await fetch(
    `https://slack.com/api/conversations.history?channel=${channel}&limit=${limit}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  return data.messages as Array<{
    type: string;
    user: string;
    text: string;
    ts: string;
  }>;
}

export async function exchangeSlackCode(code: string) {
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: SLACK_CLIENT_ID!,
      client_secret: SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: SLACK_REDIRECT_URI,
    }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || "Failed to exchange code");
  }

  return data as {
    ok: boolean;
    access_token: string;
    token_type: string;
    scope: string;
    bot_user_id: string;
    app_id: string;
    team: {
      id: string;
      name: string;
    };
    authed_user: {
      id: string;
    };
  };
}

export async function saveSlackIntegration(
  userId: string,
  tokenData: Awaited<ReturnType<typeof exchangeSlackCode>>
) {
  const encryptedToken = encrypt(tokenData.access_token);

  await prisma.integration.upsert({
    where: { userId_type: { userId, type: "SLACK" } },
    create: {
      userId,
      type: "SLACK",
      accessToken: encryptedToken,
      accountName: tokenData.team?.name,
      scopes: tokenData.scope?.split(",") || [],
      teamId: tokenData.team?.id,
      teamName: tokenData.team?.name,
      botUserId: tokenData.bot_user_id,
    },
    update: {
      accessToken: encryptedToken,
      accountName: tokenData.team?.name,
      scopes: tokenData.scope?.split(",") || [],
      teamId: tokenData.team?.id,
      teamName: tokenData.team?.name,
      botUserId: tokenData.bot_user_id,
    },
  });
}

export async function getSlackIntegrationByTeamId(teamId: string) {
  return prisma.integration.findFirst({
    where: {
      type: "SLACK",
      teamId,
    },
  });
}

export async function disconnectSlack(userId: string) {
  await prisma.integration.delete({
    where: { userId_type: { userId, type: "SLACK" } },
  });
}
