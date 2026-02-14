// ---------------------------------------------------------------------------
// Instantly.ai v2 API Client
// Wraps https://api.instantly.ai/api/v2/ endpoints for account management,
// warmup control, and analytics.
// ---------------------------------------------------------------------------

const BASE_URL = "https://api.instantly.ai/api/v2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InstantlyAccount {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  warmup_enabled: boolean;
  status: string;
  created_at: string;
}

export interface InstantlyWarmupStats {
  total_sent: number;
  total_received: number;
  warmup_score: number;
  reputation: string;
}

export interface InstantlyAccountAnalytics {
  total_sent: number;
  total_delivered: number;
  total_bounced: number;
  total_opened: number;
  total_replied: number;
  delivery_rate: number;
  bounce_rate: number;
  open_rate: number;
  reply_rate: number;
}

export interface InstantlyApiError {
  error: string;
  message: string;
  statusCode: number;
}

interface InstantlyListResponse<T> {
  items: T[];
  total_count: number;
  limit: number;
  skip: number;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class InstantlyError extends Error {
  public readonly statusCode: number;
  public readonly apiError: string;

  constructor({ error, message, statusCode }: InstantlyApiError) {
    super(message);
    this.name = "InstantlyError";
    this.statusCode = statusCode;
    this.apiError = error;
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class InstantlyClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    body?: Record<string, unknown>,
    queryParams?: Record<string, string | number | undefined>
  ): Promise<T> {
    let url = `${BASE_URL}${path}`;

    if (queryParams) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined) {
          params.set(key, String(value));
        }
      }
      const qs = params.toString();
      if (qs) {
        url += `?${qs}`;
      }
    }

    const init: RequestInit = {
      method,
      headers: this.headers(),
    };

    if (body && method !== "GET") {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    // DELETE may return 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    const data: unknown = await response.json();

    if (!response.ok) {
      const apiError = data as Partial<InstantlyApiError>;
      throw new InstantlyError({
        error: apiError.error ?? "unknown_error",
        message: apiError.message ?? `Instantly API responded with ${response.status}`,
        statusCode: response.status,
      });
    }

    return data as T;
  }

  // -------------------------------------------------------------------------
  // Account Management
  // -------------------------------------------------------------------------

  /**
   * Add (create) a new email account.
   */
  async addAccount(
    email: string,
    firstName?: string,
    lastName?: string
  ): Promise<InstantlyAccount> {
    return this.request<InstantlyAccount>("POST", "/accounts", {
      email,
      ...(firstName !== undefined && { first_name: firstName }),
      ...(lastName !== undefined && { last_name: lastName }),
    });
  }

  /**
   * Remove an email account by ID.
   */
  async removeAccount(accountId: string): Promise<void> {
    await this.request<void>("DELETE", `/accounts/${accountId}`);
  }

  /**
   * Get a single account's details and status.
   */
  async getAccountStatus(accountId: string): Promise<InstantlyAccount> {
    return this.request<InstantlyAccount>("GET", `/accounts/${accountId}`);
  }

  /**
   * List all email accounts with optional pagination.
   */
  async listAccounts(
    limit?: number,
    skip?: number
  ): Promise<InstantlyListResponse<InstantlyAccount>> {
    return this.request<InstantlyListResponse<InstantlyAccount>>(
      "GET",
      "/accounts",
      undefined,
      { limit, skip }
    );
  }

  // -------------------------------------------------------------------------
  // Warmup Control
  // -------------------------------------------------------------------------

  /**
   * Enable warmup for an email account.
   */
  async enableWarmup(accountId: string): Promise<InstantlyAccount> {
    return this.request<InstantlyAccount>(
      "POST",
      `/accounts/${accountId}/warmup/enable`
    );
  }

  /**
   * Disable warmup for an email account.
   */
  async disableWarmup(accountId: string): Promise<InstantlyAccount> {
    return this.request<InstantlyAccount>(
      "POST",
      `/accounts/${accountId}/warmup/disable`
    );
  }

  /**
   * Get warmup statistics for an email account.
   */
  async getWarmupStats(accountId: string): Promise<InstantlyWarmupStats> {
    return this.request<InstantlyWarmupStats>(
      "GET",
      `/accounts/${accountId}/warmup`
    );
  }

  // -------------------------------------------------------------------------
  // Analytics
  // -------------------------------------------------------------------------

  /**
   * Get account-level analytics (sent, delivered, bounced, opened, replied)
   * for a given date range. Optionally filter to a specific account.
   */
  async getAccountAnalytics(
    startDate: string,
    endDate: string,
    accountId?: string
  ): Promise<InstantlyAccountAnalytics> {
    return this.request<InstantlyAccountAnalytics>(
      "GET",
      "/analytics/campaign/summary",
      undefined,
      {
        start_date: startDate,
        end_date: endDate,
        ...(accountId !== undefined && { account_id: accountId }),
      }
    );
  }
}

// ---------------------------------------------------------------------------
// Singleton helper
// ---------------------------------------------------------------------------

let cachedClient: InstantlyClient | null = null;

export function getInstantlyClient(): InstantlyClient {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.INSTANTLY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "INSTANTLY_API_KEY environment variable is required. " +
        "Make sure it's set in your .env file."
    );
  }

  cachedClient = new InstantlyClient(apiKey);
  return cachedClient;
}
