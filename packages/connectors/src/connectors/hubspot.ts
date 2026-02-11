/**
 * HubSpot Connector
 *
 * CRM connector for HubSpot API.
 */

import { z } from "zod";
import { BaseConnector, type ConnectorContext, type ActionResult } from "../base";

// ============================================
// Schemas
// ============================================

const ContactSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  properties: z.record(z.unknown()).optional(),
});

const DealSchema = z.object({
  id: z.string(),
  dealname: z.string().optional(),
  amount: z.number().optional(),
  dealstage: z.string().optional(),
  closedate: z.string().optional(),
  properties: z.record(z.unknown()).optional(),
});

const SearchContactsInput = z.object({
  query: z.string().optional(),
  email: z.string().optional(),
  limit: z.number().optional(),
});

const GetDealInput = z.object({
  dealId: z.string(),
});

const SearchDealsInput = z.object({
  stage: z.string().optional(),
  ownerId: z.string().optional(),
  limit: z.number().optional(),
});

const CreateContactInput = z.object({
  email: z.string().email(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
});

const UpdateDealInput = z.object({
  dealId: z.string(),
  properties: z.record(z.string()),
});

// ============================================
// Connector Implementation
// ============================================

export class HubSpotConnector extends BaseConnector {
  readonly id = "hubspot";
  readonly name = "HubSpot";
  readonly description = "CRM, marketing, and sales platform";
  readonly category = "CRM" as const;
  readonly icon = "logos:hubspot";
  readonly pipedreamAppSlug = "hubspot";

  readonly requiredScopes = [
    "crm.objects.contacts.read",
    "crm.objects.contacts.write",
    "crm.objects.deals.read",
    "crm.objects.deals.write",
  ];

  readonly optionalScopes = [
    "crm.objects.companies.read",
    "crm.objects.companies.write",
    "sales-email-read",
  ];

  constructor() {
    super();
    this.registerActions();
  }

  private registerActions(): void {
    // Search Contacts
    this.registerAction({
      id: "search-contacts",
      name: "Search Contacts",
      description: "Search for contacts in HubSpot",
      inputSchema: SearchContactsInput,
      outputSchema: z.array(ContactSchema),
      execute: async (input, context) => {
        return this.searchContacts(input, context);
      },
    });

    // Get Deal
    this.registerAction({
      id: "get-deal",
      name: "Get Deal",
      description: "Get a deal by ID",
      inputSchema: GetDealInput,
      outputSchema: DealSchema,
      execute: async (input, context) => {
        return this.getDeal(input, context);
      },
    });

    // Search Deals
    this.registerAction({
      id: "search-deals",
      name: "Search Deals",
      description: "Search for deals in HubSpot",
      inputSchema: SearchDealsInput,
      outputSchema: z.array(DealSchema),
      execute: async (input, context) => {
        return this.searchDeals(input, context);
      },
    });

    // Create Contact
    this.registerAction({
      id: "create-contact",
      name: "Create Contact",
      description: "Create a new contact in HubSpot",
      inputSchema: CreateContactInput,
      outputSchema: ContactSchema,
      execute: async (input, context) => {
        return this.createContact(input, context);
      },
    });

    // Update Deal
    this.registerAction({
      id: "update-deal",
      name: "Update Deal",
      description: "Update a deal in HubSpot",
      inputSchema: UpdateDealInput,
      outputSchema: DealSchema,
      execute: async (input, context) => {
        return this.updateDeal(input, context);
      },
    });
  }

  // ============================================
  // Action Implementations
  // ============================================

  private async searchContacts(
    input: z.infer<typeof SearchContactsInput>,
    context: ConnectorContext
  ): Promise<ActionResult<z.infer<typeof ContactSchema>[]>> {
    const response = await this.apiRequest(
      context,
      "POST",
      "/crm/v3/objects/contacts/search",
      {
        filterGroups: input.email
          ? [
              {
                filters: [
                  { propertyName: "email", operator: "EQ", value: input.email },
                ],
              },
            ]
          : [],
        query: input.query,
        limit: input.limit ?? 10,
      }
    );

    if (!response.success) return response as any;

    const contacts = (response.data as { results: unknown[] }).results.map(
      (c: unknown) => {
        const contact = c as { id: string; properties: Record<string, unknown> };
        return {
          id: contact.id,
          ...contact.properties,
        };
      }
    );

    return { success: true, data: contacts };
  }

  private async getDeal(
    input: z.infer<typeof GetDealInput>,
    context: ConnectorContext
  ): Promise<ActionResult<z.infer<typeof DealSchema>>> {
    return this.apiRequest(
      context,
      "GET",
      `/crm/v3/objects/deals/${input.dealId}`
    );
  }

  private async searchDeals(
    input: z.infer<typeof SearchDealsInput>,
    context: ConnectorContext
  ): Promise<ActionResult<z.infer<typeof DealSchema>[]>> {
    const filters = [];
    if (input.stage) {
      filters.push({
        propertyName: "dealstage",
        operator: "EQ",
        value: input.stage,
      });
    }
    if (input.ownerId) {
      filters.push({
        propertyName: "hubspot_owner_id",
        operator: "EQ",
        value: input.ownerId,
      });
    }

    const response = await this.apiRequest(
      context,
      "POST",
      "/crm/v3/objects/deals/search",
      {
        filterGroups: filters.length > 0 ? [{ filters }] : [],
        limit: input.limit ?? 10,
      }
    );

    if (!response.success) return response as any;

    const deals = (response.data as { results: unknown[] }).results.map(
      (d: unknown) => {
        const deal = d as { id: string; properties: Record<string, unknown> };
        return {
          id: deal.id,
          ...deal.properties,
        };
      }
    );

    return { success: true, data: deals };
  }

  private async createContact(
    input: z.infer<typeof CreateContactInput>,
    context: ConnectorContext
  ): Promise<ActionResult<z.infer<typeof ContactSchema>>> {
    return this.apiRequest(context, "POST", "/crm/v3/objects/contacts", {
      properties: input,
    });
  }

  private async updateDeal(
    input: z.infer<typeof UpdateDealInput>,
    context: ConnectorContext
  ): Promise<ActionResult<z.infer<typeof DealSchema>>> {
    return this.apiRequest(
      context,
      "PATCH",
      `/crm/v3/objects/deals/${input.dealId}`,
      { properties: input.properties }
    );
  }

  // ============================================
  // OAuth Methods
  // ============================================

  async testConnection(context: ConnectorContext): Promise<ActionResult<boolean>> {
    const result = await this.apiRequest(context, "GET", "/crm/v3/objects/contacts?limit=1");
    return { success: result.success, data: result.success };
  }

  getOAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: process.env.HUBSPOT_CLIENT_ID ?? "",
      redirect_uri: redirectUri,
      scope: this.requiredScopes.join(" "),
      state,
    });
    return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeOAuthCode(
    code: string,
    redirectUri: string
  ): Promise<ActionResult<{ accessToken: string; refreshToken?: string; expiresAt?: Date }>> {
    const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.HUBSPOT_CLIENT_ID ?? "",
        client_secret: process.env.HUBSPOT_CLIENT_SECRET ?? "",
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!response.ok) {
      return { success: false, error: "Failed to exchange OAuth code" };
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
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
    const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.HUBSPOT_CLIENT_ID ?? "",
        client_secret: process.env.HUBSPOT_CLIENT_SECRET ?? "",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      return { success: false, error: "Failed to refresh token" };
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
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

  // ============================================
  // API Helper
  // ============================================

  private async apiRequest<T>(
    context: ConnectorContext,
    method: string,
    path: string,
    body?: unknown
  ): Promise<ActionResult<T>> {
    const url = `https://api.hubapi.com${path}`;

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

    const data = (await response.json()) as T;
    return { success: true, data };
  }
}
