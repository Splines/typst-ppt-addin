import { typst } from "./typst.js";
import { storeValue } from "./state.js";
import { applyFillColor, parseAndApplySize } from "./svg.js";
import { DOM_IDS, DEFAULTS, BUTTON_TEXT, PREVIEW_CONFIG, STORAGE_KEYS, THEMES, FILL_COLOR_DISABLED } from "./constants.js";
import { getInputElement, getHTMLElement } from "./dom.js";

/**
 * Sets the status message in the UI.
 */
export function setStatus(message: string, isError = false) {
  const statusElement = getHTMLElement(DOM_IDS.STATUS);
  statusElement.textContent = message || "";
  statusElement.classList.toggle("error", isError);
}

/**
 * @returns the current font size from the UI
 */
export function getFontSize(): string {
  return getInputElement(DOM_IDS.FONT_SIZE).value;
}

/**
 * Sets the font size in the UI.
 */
export function setFontSize(fontSize: string) {
  getInputElement(DOM_IDS.FONT_SIZE).value = fontSize;
}

/**
 * @returns Fill color value or empty string if disabled
 */
export function getFillColor(): string {
  const checkbox = getInputElement(DOM_IDS.FILL_COLOR_ENABLED);
  const enabled = checkbox.checked;
  if (!enabled) return "";

  const fillColorInput = getInputElement(DOM_IDS.FILL_COLOR);
  return fillColorInput.value || DEFAULTS.FILL_COLOR;
}

/**
 * Sets the fill color in the UI.
 *
 * @param color Fill color to set, or null to disable
 */
export function setFillColor(color: string | null) {
  const fillColorInput = getInputElement(DOM_IDS.FILL_COLOR);
  const checkbox = getInputElement(DOM_IDS.FILL_COLOR_ENABLED);

  if (color) {
    checkbox.checked = true;
    fillColorInput.value = color;
    fillColorInput.disabled = false;
  } else {
    checkbox.checked = false;
    fillColorInput.disabled = true;
  }
}

/**
 * @returns Typst source code from the UI input
 */
export function getTypstCode(): string {
  return getInputElement(DOM_IDS.TYPST_INPUT).value;
}

/**
 * Sets the Typst code in the UI input.
 */
export function setTypstCode(typstCode: string) {
  getInputElement(DOM_IDS.TYPST_INPUT).value = typstCode;
}

/**
 * Updates the button text based on whether a Typst shape is selected.
 */
export function setButtonText(isEditingExistingFormula: boolean) {
  const button = getHTMLElement(DOM_IDS.INSERT_BTN) as HTMLButtonElement;
  button.innerText = isEditingExistingFormula ? BUTTON_TEXT.UPDATE : BUTTON_TEXT.INSERT;
}

/**
 * Enables or disables the insert button.
 */
export function setButtonEnabled(enabled: boolean) {
  const button = getHTMLElement(DOM_IDS.INSERT_BTN) as HTMLButtonElement;
  button.disabled = !enabled;
}

/**
 * Updates the preview panel with compiled SVG.
 */
export async function updatePreview() {
  const rawCode = getTypstCode().trim();
  const fontSize = getFontSize();
  const previewElement = getHTMLElement(DOM_IDS.PREVIEW_CONTENT);

  if (!rawCode) {
    previewElement.innerHTML = "";
    return;
  }

  let svgOutput: string;
  try {
    svgOutput = await typst(rawCode, fontSize);
  } catch {
    // TODO: better error handling
    previewElement.innerText = "";
    return;
  }

  const { svgElement: processedSvg } = parseAndApplySize(svgOutput);
  previewElement.innerHTML = processedSvg.outerHTML;
  previewElement.style.color = "";

  const svgElement = previewElement.querySelector("svg");
  if (!svgElement) return;

  svgElement.style.width = "100%";
  svgElement.style.height = "auto";
  svgElement.style.maxHeight = PREVIEW_CONFIG.MAX_HEIGHT;

  const isDarkMode = !document.documentElement.classList.contains("light-mode");
  const previewFill = isDarkMode ? PREVIEW_CONFIG.DARK_MODE_FILL : PREVIEW_CONFIG.LIGHT_MODE_FILL;
  applyFillColor(svgElement, previewFill);
}

/**
 * Sets up event listeners for preview updates.
 */
export function setupPreviewListeners() {
  const typstInput = getInputElement(DOM_IDS.TYPST_INPUT);
  const fontSizeInput = getInputElement(DOM_IDS.FONT_SIZE);
  const fillColorInput = getInputElement(DOM_IDS.FILL_COLOR);
  const fillColorEnabled = getInputElement(DOM_IDS.FILL_COLOR_ENABLED);

  typstInput.addEventListener("input", () => {
    void updatePreview();
  });

  fontSizeInput.addEventListener("input", () => {
    const fontSize = getFontSize();
    storeValue(STORAGE_KEYS.FONT_SIZE, fontSize);
    void updatePreview();
  });

  fillColorInput.addEventListener("input", () => {
    const fillColor = getFillColor();
    storeValue(STORAGE_KEYS.FILL_COLOR, fillColor);
    void updatePreview();
  });

  fillColorEnabled.addEventListener("change", () => {
    const fillColor = getFillColor();
    const colorInput = getInputElement(DOM_IDS.FILL_COLOR);
    colorInput.disabled = !fillColorEnabled.checked;
    storeValue(STORAGE_KEYS.FILL_COLOR, fillColor || FILL_COLOR_DISABLED);
    void updatePreview();
  });
}

/**
 * Initializes dark mode based on stored preference (defaults to dark mode).
 */
export function initializeDarkMode() {
  const darkModeToggle = getInputElement(DOM_IDS.DARK_MODE_TOGGLE);
  const isDarkMode = isDarkModeEnabled();

  darkModeToggle.checked = isDarkMode;
  applyTheme(isDarkMode);
}

/**
 * @returns whether dark mode is enabled
 */
function isDarkModeEnabled(): boolean {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
  return savedTheme === null ? true : savedTheme === THEMES.DARK;
}

/**
 * Applies the theme to the document.
 */
function applyTheme(isDark: boolean) {
  const root = document.documentElement;
  if (isDark) {
    root.classList.remove("light-mode");
  } else {
    root.classList.add("light-mode");
  }
}

/**
 * Sets up the dark mode toggle listener.
 */
export function setupDarkModeToggle() {
  const darkModeToggle = getInputElement(DOM_IDS.DARK_MODE_TOGGLE);
  darkModeToggle.addEventListener("change", (event) => {
    const isDark = (event.target as HTMLInputElement).checked;
    applyTheme(isDark);
    localStorage.setItem(STORAGE_KEYS.THEME, isDark ? THEMES.DARK : THEMES.LIGHT);
    void updatePreview();
  });
}
