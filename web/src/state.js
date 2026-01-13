/**
 * Application state management
 */

export const state = {
  isWasmReady: false,
  lastTypstSelection: null,
  compilerConfig: {
    url: null,
    auth: null,
  },
};

/**
 * Updates the WASM ready state
 * @param {boolean} ready - Whether WASM is ready
 */
export function setWasmReady(ready) {
  state.isWasmReady = ready;
}

/**
 * Updates the last selected Typst shape information
 * @param {Object|null} selection - Selection info with slideId, shapeId, left, top, width, height
 */
export function setLastTypstSelection(selection) {
  state.lastTypstSelection = selection;
}

/**
 * Updates the compiler configuration
 * @param {string|null} url - Compiler service URL
 * @param {string|null} auth - Authentication token
 */
export function setCompilerConfig(url, auth) {
  state.compilerConfig.url = url;
  state.compilerConfig.auth = auth;
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
