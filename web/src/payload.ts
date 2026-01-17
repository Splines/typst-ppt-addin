import { decodeBase64, encodeBase64 } from "./utils/base64";

const TYPST_PREFIX = "TYPST:";

/**
 * Creates a Typst payload from source code.
 */
export function createTypstPayload(code: string): string {
  return `${TYPST_PREFIX}${encodeBase64(code)}`;
}

/**
 * Checks if an alt text description is a Typst payload.
 */
export function isTypstPayload(altTextDescription: string | undefined): boolean {
  return !!(altTextDescription && altTextDescription.startsWith(TYPST_PREFIX));
}

/**
 * Extracts Typst code from a payload.
 */
export function extractTypstCode(payload: string): string {
  const base64Payload = payload.split(TYPST_PREFIX)[1];
  return decodeBase64(base64Payload);
}
