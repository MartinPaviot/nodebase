import { Resolver } from "node:dns/promises";

export interface BlacklistResult {
  isBlacklisted: boolean;
  blacklistedOn: string[];
  checkedLists: string[];
  checkTime: number;
}

const DNSBL_LISTS = [
  "zen.spamhaus.org",
  "b.barracudacentral.org",
  "bl.spamcop.net",
  "dnsbl.sorbs.net",
  "psbl.surriel.com",
  "all.s5h.net",
] as const;

const DNSBL_TIMEOUT_MS = 5_000;

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

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("DNSBL_TIMEOUT"));
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

interface DnsblCheckOutcome {
  list: string;
  listed: boolean;
}

async function checkSingleDnsbl(
  resolver: Resolver,
  domain: string,
  dnsbl: string,
): Promise<DnsblCheckOutcome> {
  const lookupDomain = `${domain}.${dnsbl}`;

  try {
    // If the DNS query resolves (returns IP addresses), the domain IS listed
    const addresses = await withTimeout(
      resolver.resolve4(lookupDomain),
      DNSBL_TIMEOUT_MS,
    );

    // A successful resolution means the domain is blacklisted on this list
    return { list: dnsbl, listed: addresses.length > 0 };
  } catch (err) {
    // NXDOMAIN / NOTFOUND means the domain is NOT listed (this is the good case)
    if (isDnsNotFoundError(err)) {
      return { list: dnsbl, listed: false };
    }

    // Timeout or other network errors - treat as not listed to avoid false positives
    return { list: dnsbl, listed: false };
  }
}

export async function checkBlacklists(
  domain: string,
): Promise<BlacklistResult> {
  const startTime = performance.now();
  const resolver = new Resolver();

  const checkedLists = [...DNSBL_LISTS];

  const results = await Promise.allSettled(
    DNSBL_LISTS.map((dnsbl) => checkSingleDnsbl(resolver, domain, dnsbl)),
  );

  const blacklistedOn: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.listed) {
      blacklistedOn.push(result.value.list);
    }
    // Rejected promises (unexpected errors) are treated as not listed
    // to avoid false positives from transient failures
  }

  const endTime = performance.now();
  const checkTime = Math.round(endTime - startTime);

  return {
    isBlacklisted: blacklistedOn.length > 0,
    blacklistedOn,
    checkedLists,
    checkTime,
  };
}
