import {
  BaseConnector
} from "./chunk-WX3K3UJC.mjs";

// src/connectors/hubspot.ts
import { z } from "zod";
var ContactSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  properties: z.record(z.unknown()).optional()
});
var DealSchema = z.object({
  id: z.string(),
  dealname: z.string().optional(),
  amount: z.number().optional(),
  dealstage: z.string().optional(),
  closedate: z.string().optional(),
  properties: z.record(z.unknown()).optional()
});
var SearchContactsInput = z.object({
  query: z.string().optional(),
  email: z.string().optional(),
  limit: z.number().optional()
});
var GetDealInput = z.object({
  dealId: z.string()
});
var SearchDealsInput = z.object({
  stage: z.string().optional(),
  ownerId: z.string().optional(),
  limit: z.number().optional()
});
var CreateContactInput = z.object({
  email: z.string().email(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional()
});
var UpdateDealInput = z.object({
  dealId: z.string(),
  properties: z.record(z.string())
});
var HubSpotConnector = class extends BaseConnector {
  id = "hubspot";
  name = "HubSpot";
  description = "CRM, marketing, and sales platform";
  category = "CRM";
  icon = "logos:hubspot";
  pipedreamAppSlug = "hubspot";
  requiredScopes = [
    "crm.objects.contacts.read",
    "crm.objects.contacts.write",
    "crm.objects.deals.read",
    "crm.objects.deals.write"
  ];
  optionalScopes = [
    "crm.objects.companies.read",
    "crm.objects.companies.write",
    "sales-email-read"
  ];
  constructor() {
    super();
    this.registerActions();
  }
  registerActions() {
    this.registerAction({
      id: "search-contacts",
      name: "Search Contacts",
      description: "Search for contacts in HubSpot",
      inputSchema: SearchContactsInput,
      outputSchema: z.array(ContactSchema),
      execute: async (input, context) => {
        return this.searchContacts(input, context);
      }
    });
    this.registerAction({
      id: "get-deal",
      name: "Get Deal",
      description: "Get a deal by ID",
      inputSchema: GetDealInput,
      outputSchema: DealSchema,
      execute: async (input, context) => {
        return this.getDeal(input, context);
      }
    });
    this.registerAction({
      id: "search-deals",
      name: "Search Deals",
      description: "Search for deals in HubSpot",
      inputSchema: SearchDealsInput,
      outputSchema: z.array(DealSchema),
      execute: async (input, context) => {
        return this.searchDeals(input, context);
      }
    });
    this.registerAction({
      id: "create-contact",
      name: "Create Contact",
      description: "Create a new contact in HubSpot",
      inputSchema: CreateContactInput,
      outputSchema: ContactSchema,
      execute: async (input, context) => {
        return this.createContact(input, context);
      }
    });
    this.registerAction({
      id: "update-deal",
      name: "Update Deal",
      description: "Update a deal in HubSpot",
      inputSchema: UpdateDealInput,
      outputSchema: DealSchema,
      execute: async (input, context) => {
        return this.updateDeal(input, context);
      }
    });
  }
  // ============================================
  // Action Implementations
  // ============================================
  async searchContacts(input, context) {
    const response = await this.apiRequest(
      context,
      "POST",
      "/crm/v3/objects/contacts/search",
      {
        filterGroups: input.email ? [
          {
            filters: [
              { propertyName: "email", operator: "EQ", value: input.email }
            ]
          }
        ] : [],
        query: input.query,
        limit: input.limit ?? 10
      }
    );
    if (!response.success) return response;
    const contacts = response.data.results.map(
      (c) => {
        const contact = c;
        return {
          id: contact.id,
          ...contact.properties
        };
      }
    );
    return { success: true, data: contacts };
  }
  async getDeal(input, context) {
    return this.apiRequest(
      context,
      "GET",
      `/crm/v3/objects/deals/${input.dealId}`
    );
  }
  async searchDeals(input, context) {
    const filters = [];
    if (input.stage) {
      filters.push({
        propertyName: "dealstage",
        operator: "EQ",
        value: input.stage
      });
    }
    if (input.ownerId) {
      filters.push({
        propertyName: "hubspot_owner_id",
        operator: "EQ",
        value: input.ownerId
      });
    }
    const response = await this.apiRequest(
      context,
      "POST",
      "/crm/v3/objects/deals/search",
      {
        filterGroups: filters.length > 0 ? [{ filters }] : [],
        limit: input.limit ?? 10
      }
    );
    if (!response.success) return response;
    const deals = response.data.results.map(
      (d) => {
        const deal = d;
        return {
          id: deal.id,
          ...deal.properties
        };
      }
    );
    return { success: true, data: deals };
  }
  async createContact(input, context) {
    return this.apiRequest(context, "POST", "/crm/v3/objects/contacts", {
      properties: input
    });
  }
  async updateDeal(input, context) {
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
  async testConnection(context) {
    const result = await this.apiRequest(context, "GET", "/crm/v3/objects/contacts?limit=1");
    return { success: result.success, data: result.success };
  }
  getOAuthUrl(state, redirectUri) {
    const params = new URLSearchParams({
      client_id: process.env.HUBSPOT_CLIENT_ID ?? "",
      redirect_uri: redirectUri,
      scope: this.requiredScopes.join(" "),
      state
    });
    return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
  }
  async exchangeOAuthCode(code, redirectUri) {
    const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.HUBSPOT_CLIENT_ID ?? "",
        client_secret: process.env.HUBSPOT_CLIENT_SECRET ?? "",
        redirect_uri: redirectUri,
        code
      })
    });
    if (!response.ok) {
      return { success: false, error: "Failed to exchange OAuth code" };
    }
    const data = await response.json();
    return {
      success: true,
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1e3)
      }
    };
  }
  async refreshAccessToken(refreshToken) {
    const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.HUBSPOT_CLIENT_ID ?? "",
        client_secret: process.env.HUBSPOT_CLIENT_SECRET ?? "",
        refresh_token: refreshToken
      })
    });
    if (!response.ok) {
      return { success: false, error: "Failed to refresh token" };
    }
    const data = await response.json();
    return {
      success: true,
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1e3)
      }
    };
  }
  // ============================================
  // API Helper
  // ============================================
  async apiRequest(context, method, path, body) {
    const url = `https://api.hubapi.com${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : void 0
    });
    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }
    const data = await response.json();
    return { success: true, data };
  }
};

export {
  HubSpotConnector
};
