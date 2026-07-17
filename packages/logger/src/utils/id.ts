const FALLBACK_ID_LENGTH = 12;

function getCrypto(): Crypto | undefined {
  if (typeof globalThis.crypto !== "undefined") {
    return globalThis.crypto;
  }
  return;
}

function fallbackRequestId(): string {
  const crypto = getCrypto();
  if (crypto && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(FALLBACK_ID_LENGTH);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
      ""
    );
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

/** Generates a unique request identifier. */
export function generateRequestId(): string {
  const crypto = getCrypto();
  if (crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return fallbackRequestId();
}
