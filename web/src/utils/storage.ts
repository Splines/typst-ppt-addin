/**
 * Retrieves a value from localStorage
 *
 */
export function getStoredValue(key: string): string | null {
  return localStorage.getItem(key);
}

/**
 * Stores a value in localStorage
 */
export function storeValue(key: string, value: string) {
  localStorage.setItem(key, value);
}
