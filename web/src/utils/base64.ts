/**
 * Encodes a string to base64 using UTF-8 encoding.
 */
export function encodeBase64(str: string) {
  const encoder = new TextEncoder();
  return btoa(String.fromCharCode(...encoder.encode(str)));
}

/**
 * Decodes a base64 string back to UTF-8.
 */
export function decodeBase64(base64: string) {
  const decoder = new TextDecoder();
  return decoder.decode(Uint8Array.from(atob(base64), c => c.charCodeAt(0)));
}
