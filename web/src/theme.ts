import { updatePreview } from "./preview.js";
import { getInputElement } from "./utils/dom";
import { DOM_IDS, STORAGE_KEYS, THEMES } from "./constants.js";

/**
 * Initializes dark mode based on stored preference (defaults to light mode).
 */
export function initializeDarkMode() {
  const isDarkMode = isDarkModeEnabled();
  const darkModeToggle = getInputElement(DOM_IDS.DARK_MODE_TOGGLE);
  darkModeToggle.checked = !isDarkMode;
  applyTheme(isDarkMode);
}

/**
 * @returns whether dark mode is enabled
 */
function isDarkModeEnabled(): boolean {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
  return savedTheme === null ? false : savedTheme === THEMES.DARK;
}

/**
 * Applies the theme to the document.
 */
function applyTheme(isDark: boolean) {
  const root = document.documentElement;
  if (isDark) {
    root.classList.add("dark-mode");
  } else {
    root.classList.remove("dark-mode");
  }
}

/**
 * Sets up the dark mode toggle listener.
 */
export function setupDarkModeToggle() {
  const darkModeToggle = getInputElement(DOM_IDS.DARK_MODE_TOGGLE);
  darkModeToggle.addEventListener("change", (event) => {
    const isDark = !(event.target as HTMLInputElement).checked;
    applyTheme(isDark);
    localStorage.setItem(STORAGE_KEYS.THEME, isDark ? THEMES.DARK : THEMES.LIGHT);
    void updatePreview();
  });
}
