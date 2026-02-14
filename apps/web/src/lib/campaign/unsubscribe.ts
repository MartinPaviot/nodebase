/**
 * Unsubscribe Handler — RFC 8058 compliant
 *
 * Generates signed unsubscribe URLs and headers for cold emails.
 * Uses JWT-like HMAC tokens to prevent abuse.
 */

import crypto from 'node:crypto';

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || process.env.BETTER_AUTH_SECRET || 'fallback-change-me';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Generate a signed unsubscribe token for a campaign email.
 * Token = base64url(emailId:timestamp:signature)
 */
export function generateUnsubscribeToken(emailId: string): string {
  const timestamp = Date.now().toString(36);
  const payload = `${emailId}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', UNSUBSCRIBE_SECRET)
    .update(payload)
    .digest('base64url');

  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

/**
 * Verify and decode an unsubscribe token.
 * Returns the emailId if valid, null if tampered/expired.
 */
export function verifyUnsubscribeToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return null;

    const [emailId, timestamp, signature] = parts;
    if (!emailId || !timestamp || !signature) return null;

    // Verify signature
    const payload = `${emailId}:${timestamp}`;
    const expectedSignature = crypto
      .createHmac('sha256', UNSUBSCRIBE_SECRET)
      .update(payload)
      .digest('base64url');

    if (signature !== expectedSignature) return null;

    // Check expiry (90 days)
    const tokenTime = parseInt(timestamp, 36);
    const maxAge = 90 * 24 * 60 * 60 * 1000;
    if (Date.now() - tokenTime > maxAge) return null;

    return emailId;
  } catch {
    return null;
  }
}

/**
 * Generate the full unsubscribe URL for a campaign email.
 */
export function generateUnsubscribeUrl(emailId: string): string {
  const token = generateUnsubscribeToken(emailId);
  return `${BASE_URL}/api/unsubscribe/${token}`;
}

/**
 * Generate RFC 8058 compliant unsubscribe headers.
 * These headers enable one-click unsubscribe in Gmail/Outlook.
 */
export function generateUnsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
