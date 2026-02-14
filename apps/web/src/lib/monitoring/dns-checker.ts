import { Resolver } from "node:dns/promises";

type DnsStatus = "PASS" | "WARN" | "FAIL" | "UNKNOWN";

export interface DnsCheckResult {
  spfStatus: DnsStatus;
  spfRecord: string | null;
  dkimStatus: DnsStatus;
  dkimRecord: string | null;
  dmarcStatus: DnsStatus;
  dmarcRecord: string | null;
  dmarcPolicy: string | null;
  mxStatus: DnsStatus;
  mxRecords: string[];
  overallScore: number;
}

const DNS_TIMEOUT_MS = 5_000;

function statusToScore(status: DnsStatus): number {
  switch (status) {
    case "PASS":
      return 25;
    case "WARN":
      return 12;
    case "FAIL":
    case "UNKNOWN":
      return 0;
  }
}

function createResolver(): Resolver {
  return new Resolver();
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("DNS_TIMEOUT"));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function isDnsNotFoundError(err: unknown): boolean {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    return (
      code === "ENODATA" ||
      code === "ENOTFOUND" ||
      code === "NXDOMAIN" ||
      code === "ESERVFAIL"
    );
  }
  return false;
}

async function checkSpf(
  resolver: Resolver,
  domain: string,
): Promise<{ status: DnsStatus; record: string | null }> {
  try {
    const records = await withTimeout(
      resolver.resolveTxt(domain),
      DNS_TIMEOUT_MS,
    );

    const flatRecords = records.map((chunks) => chunks.join(""));
    const spfRecord = flatRecords.find((r) => r.startsWith("v=spf1"));

    if (!spfRecord) {
      return { status: "FAIL", record: null };
    }

    const lowered = spfRecord.toLowerCase();

    if (lowered.includes("+all") || lowered.includes("?all")) {
      return { status: "WARN", record: spfRecord };
    }

    if (lowered.includes("-all") || lowered.includes("~all")) {
      return { status: "PASS", record: spfRecord };
    }

    // SPF record exists but no explicit all mechanism
    return { status: "WARN", record: spfRecord };
  } catch (err) {
    if (isDnsNotFoundError(err)) {
      return { status: "FAIL", record: null };
    }
    return { status: "UNKNOWN", record: null };
  }
}

async function checkDkim(
  resolver: Resolver,
  domain: string,
): Promise<{ status: DnsStatus; record: string | null }> {
  // Try the Google Workspace default DKIM selector
  const dkimDomain = `google._domainkey.${domain}`;

  try {
    const records = await withTimeout(
      resolver.resolveTxt(dkimDomain),
      DNS_TIMEOUT_MS,
    );

    const flatRecords = records.map((chunks) => chunks.join(""));
    const dkimRecord = flatRecords.find((r) => r.includes("v=DKIM1"));

    if (dkimRecord) {
      return { status: "PASS", record: dkimRecord };
    }

    // TXT records exist at the DKIM selector but none contain v=DKIM1
    // This could still be a valid DKIM record in some configurations
    if (flatRecords.length > 0) {
      return { status: "WARN", record: flatRecords[0] };
    }

    return { status: "FAIL", record: null };
  } catch (err) {
    if (isDnsNotFoundError(err)) {
      return { status: "FAIL", record: null };
    }
    return { status: "UNKNOWN", record: null };
  }
}

async function checkDmarc(
  resolver: Resolver,
  domain: string,
): Promise<{ status: DnsStatus; record: string | null; policy: string | null }> {
  const dmarcDomain = `_dmarc.${domain}`;

  try {
    const records = await withTimeout(
      resolver.resolveTxt(dmarcDomain),
      DNS_TIMEOUT_MS,
    );

    const flatRecords = records.map((chunks) => chunks.join(""));
    const dmarcRecord = flatRecords.find((r) => r.startsWith("v=DMARC1"));

    if (!dmarcRecord) {
      return { status: "FAIL", record: null, policy: null };
    }

    // Extract the policy value from p=<value>
    const policyMatch = dmarcRecord.match(/;\s*p=([^;\s]+)/i);
    const policy = policyMatch ? policyMatch[1].toLowerCase() : null;

    if (policy === "reject" || policy === "quarantine") {
      return { status: "PASS", record: dmarcRecord, policy };
    }

    if (policy === "none") {
      return { status: "WARN", record: dmarcRecord, policy };
    }

    // DMARC record exists but policy could not be parsed
    return { status: "WARN", record: dmarcRecord, policy };
  } catch (err) {
    if (isDnsNotFoundError(err)) {
      return { status: "FAIL", record: null, policy: null };
    }
    return { status: "UNKNOWN", record: null, policy: null };
  }
}

async function checkMx(
  resolver: Resolver,
  domain: string,
): Promise<{ status: DnsStatus; records: string[] }> {
  try {
    const mxRecords = await withTimeout(
      resolver.resolveMx(domain),
      DNS_TIMEOUT_MS,
    );

    if (mxRecords.length === 0) {
      return { status: "FAIL", records: [] };
    }

    // Sort by priority (lower = higher priority) and extract hostnames
    const hostnames = mxRecords
      .sort((a, b) => a.priority - b.priority)
      .map((mx) => mx.exchange);

    return { status: "PASS", records: hostnames };
  } catch (err) {
    if (isDnsNotFoundError(err)) {
      return { status: "FAIL", records: [] };
    }
    return { status: "UNKNOWN", records: [] };
  }
}

export async function checkDomainHealth(
  domain: string,
): Promise<DnsCheckResult> {
  const resolver = createResolver();

  const [spf, dkim, dmarc, mx] = await Promise.all([
    checkSpf(resolver, domain),
    checkDkim(resolver, domain),
    checkDmarc(resolver, domain),
    checkMx(resolver, domain),
  ]);

  const overallScore =
    statusToScore(spf.status) +
    statusToScore(dkim.status) +
    statusToScore(dmarc.status) +
    statusToScore(mx.status);

  return {
    spfStatus: spf.status,
    spfRecord: spf.record,
    dkimStatus: dkim.status,
    dkimRecord: dkim.record,
    dmarcStatus: dmarc.status,
    dmarcRecord: dmarc.record,
    dmarcPolicy: dmarc.policy,
    mxStatus: mx.status,
    mxRecords: mx.records,
    overallScore,
  };
}
