// Barrel re-exports for @/lib/instantly
export {
  InstantlyClient,
  InstantlyError,
  getInstantlyClient,
  type InstantlyAccount,
  type InstantlyWarmupStats,
  type InstantlyAccountAnalytics,
} from './client';

// Convenience helpers used by mailbox-router (delegate to singleton client)

import { getInstantlyClient } from './client';

export async function enableWarmup(accountId: string) {
  return getInstantlyClient().enableWarmup(accountId);
}

export async function disableWarmup(accountId: string) {
  return getInstantlyClient().disableWarmup(accountId);
}

export async function removeAccount(accountId: string) {
  return getInstantlyClient().removeAccount(accountId);
}

export async function addAccount(email: string, firstName?: string, lastName?: string) {
  return getInstantlyClient().addAccount(email, firstName, lastName);
}

export async function getAccountStatus(accountId: string) {
  return getInstantlyClient().getAccountStatus(accountId);
}

export async function getWarmupStats(accountId: string) {
  return getInstantlyClient().getWarmupStats(accountId);
}
