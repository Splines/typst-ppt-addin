/**
 * Application state management
 */

export const state = {
  lastTypstSelection: null,
};

/**
 * Updates the last selected Typst shape information.
 *
 * @param selection Selection info with slideId, shapeId, left, top, width, height
 */
export function setLastTypstSelection(selection: null) {
  state.lastTypstSelection = selection;
}

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
