/**
 * Server-side Composio Client
 *
 * Initializes Composio with API key from environment
 */

import { initComposio, getComposio as getComposioRaw, type ComposioClient } from "@nodebase/connectors";

let _initialized = false;

export function getComposio(): ComposioClient {
  if (!_initialized) {
    const apiKey = process.env.COMPOSIO_API_KEY;

    if (!apiKey) {
      throw new Error(
        "COMPOSIO_API_KEY environment variable is not set. " +
        "Please add it to your .env file."
      );
    }

    initComposio({ apiKey });
    _initialized = true;
  }

  return getComposioRaw();
}
