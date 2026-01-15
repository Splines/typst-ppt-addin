/**
 * Application state management
 */

export const state = {
  lastTypstSelection: null,
};

/**
 * Updates the last selected Typst shape information
 * @param {Object|null} selection - Selection info with slideId, shapeId, left, top, width, height
 */
export function setLastTypstSelection(selection) {
  state.lastTypstSelection = selection;
}

/**
 * Retrieves a value from localStorage
 * @param {string} key - Storage key
 * @returns {string|null} Stored value or null
 */
export function getStoredValue(key) {
  return localStorage.getItem(key);
}

/**
 * Stores a value in localStorage
 * @param {string} key - Storage key
 * @param {string} value - Value to store
 */
export function storeValue(key, value) {
  localStorage.setItem(key, value);
}
