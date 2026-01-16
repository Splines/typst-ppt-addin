/**
 * Application state management
 */

export type TypstForm = {
  slideId: string | null;
  shapeId: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

export let lastTypstForm: TypstForm | null;

/**
 * Updates the last selected Typst shape information.
 *
 * @param selection Selection info with slideId, shapeId, left, top, width, height
 */
export function setLastTypstForm(selection: TypstForm | null) {
  lastTypstForm = selection;
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
