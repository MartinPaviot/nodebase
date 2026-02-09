import prisma from "../db";

// Notion API base URL
const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export function getNotionAuthUrl(userId: string) {
  const clientId = process.env.NOTION_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/notion/callback`;

  return `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}&state=${userId}`;
}

async function getNotionAccessToken(userId: string): Promise<string> {
  const integration = await prisma.integration.findUnique({
    where: { userId_type: { userId, type: "NOTION" } },
  });

  if (!integration) throw new Error("Notion not connected");

  return integration.accessToken;
}

async function notionFetch(
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
) {
  const response = await fetch(`${NOTION_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Notion API error: ${response.status} - ${error.message || response.statusText}`
    );
  }

  return response.json();
}

export async function searchNotionPages(userId: string, query: string) {
  const accessToken = await getNotionAccessToken(userId);

  const response = await notionFetch(accessToken, "/search", {
    method: "POST",
    body: JSON.stringify({
      query,
      filter: { property: "object", value: "page" },
      page_size: 10,
    }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return response.results.map((page: any) => ({
    id: page.id,
    title:
      page.properties?.title?.title?.[0]?.plain_text ||
      page.properties?.Name?.title?.[0]?.plain_text ||
      "Untitled",
    url: page.url,
    lastEdited: page.last_edited_time,
  }));
}

export async function getNotionPage(userId: string, pageId: string) {
  const accessToken = await getNotionAccessToken(userId);

  const page = await notionFetch(accessToken, `/pages/${pageId}`);
  const blocks = await notionFetch(
    accessToken,
    `/blocks/${pageId}/children?page_size=100`
  );

  // Extract text content from blocks
  const content = blocks.results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((block: any) => {
      if (block.type === "paragraph") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return block.paragraph.rich_text.map((t: any) => t.plain_text).join("");
      }
      if (
        block.type === "heading_1" ||
        block.type === "heading_2" ||
        block.type === "heading_3"
      ) {
        return block[block.type].rich_text
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((t: any) => t.plain_text)
          .join("");
      }
      if (
        block.type === "bulleted_list_item" ||
        block.type === "numbered_list_item"
      ) {
        return (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "- " + block[block.type].rich_text.map((t: any) => t.plain_text).join("")
        );
      }
      if (block.type === "to_do") {
        const checked = block.to_do.checked ? "[x]" : "[ ]";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return `${checked} ${block.to_do.rich_text.map((t: any) => t.plain_text).join("")}`;
      }
      if (block.type === "code") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return `\`\`\`${block.code.language}\n${block.code.rich_text.map((t: any) => t.plain_text).join("")}\n\`\`\``;
      }
      if (block.type === "quote") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return `> ${block.quote.rich_text.map((t: any) => t.plain_text).join("")}`;
      }
      if (block.type === "divider") {
        return "---";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");

  return {
    id: page.id,
    content,
    properties: page.properties,
    url: page.url,
  };
}

export async function createNotionPage(
  userId: string,
  data: {
    parentPageId?: string;
    databaseId?: string;
    title: string;
    content: string;
  }
) {
  const accessToken = await getNotionAccessToken(userId);

  const children = data.content.split("\n").map((line) => ({
    object: "block" as const,
    type: "paragraph" as const,
    paragraph: {
      rich_text: [{ type: "text" as const, text: { content: line } }],
    },
  }));

  let body: Record<string, unknown>;

  if (data.databaseId) {
    body = {
      parent: { database_id: data.databaseId },
      properties: {
        Name: { title: [{ text: { content: data.title } }] },
      },
      children,
    };
  } else if (data.parentPageId) {
    body = {
      parent: { page_id: data.parentPageId },
      properties: {
        title: { title: [{ text: { content: data.title } }] },
      },
      children,
    };
  } else {
    throw new Error(
      "Either parentPageId or databaseId is required to create a page"
    );
  }

  const response = await notionFetch(accessToken, "/pages", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    id: response.id,
    url: response.url,
    title: data.title,
  };
}

export async function appendToNotionPage(
  userId: string,
  pageId: string,
  content: string
) {
  const accessToken = await getNotionAccessToken(userId);

  const children = content.split("\n").map((line) => ({
    object: "block" as const,
    type: "paragraph" as const,
    paragraph: {
      rich_text: [{ type: "text" as const, text: { content: line } }],
    },
  }));

  const response = await notionFetch(
    accessToken,
    `/blocks/${pageId}/children`,
    {
      method: "PATCH",
      body: JSON.stringify({ children }),
    }
  );

  return {
    success: true,
    blocksAdded: response.results.length,
  };
}

export async function listNotionDatabases(userId: string) {
  const accessToken = await getNotionAccessToken(userId);

  const response = await notionFetch(accessToken, "/search", {
    method: "POST",
    body: JSON.stringify({
      filter: { property: "object", value: "database" },
      page_size: 20,
    }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return response.results.map((db: any) => ({
    id: db.id,
    title: db.title?.[0]?.plain_text || "Untitled",
    url: db.url,
  }));
}

export async function queryNotionDatabase(
  userId: string,
  databaseId: string,
  filter?: Record<string, unknown>
) {
  const accessToken = await getNotionAccessToken(userId);

  const body: Record<string, unknown> = { page_size: 50 };
  if (filter) {
    body.filter = filter;
  }

  const response = await notionFetch(
    accessToken,
    `/databases/${databaseId}/query`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return response.results.map((page: any) => ({
    id: page.id,
    url: page.url,
    properties: page.properties,
    lastEdited: page.last_edited_time,
  }));
}

// Check if user has Notion integration
export async function hasNotionIntegration(userId: string): Promise<boolean> {
  const integration = await prisma.integration.findUnique({
    where: { userId_type: { userId, type: "NOTION" } },
  });
  return !!integration;
}
