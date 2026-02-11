import Cryptr from "cryptr";

/**
 * Lazy-load Cryptr instance to ensure ENCRYPTION_KEY is loaded from .env
 * before instantiation (fixes issue with Next.js instrumentation)
 */
let cryptr: Cryptr | null = null;

function getCryptr(): Cryptr {
  if (!cryptr) {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error(
        "ENCRYPTION_KEY environment variable is required. " +
        "Make sure it's set in your .env file."
      );
    }
    cryptr = new Cryptr(key);
  }
  return cryptr;
}

export const encrypt = (text: string) => getCryptr().encrypt(text);
export const decrypt = (text: string) => getCryptr().decrypt(text);