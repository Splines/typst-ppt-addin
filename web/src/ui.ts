import { DOM_IDS, DEFAULTS, BUTTON_TEXT, STORAGE_KEYS, FILL_COLOR_DISABLED } from "./constants.js";
import { getInputElement, getHTMLElement, getAreaElement, getButtonElement } from "./utils/dom.js";
import { insertOrUpdateFormula } from "./insertion.js";
import { getStoredValue } from "./utils/storage.js";

/**
 * Initializes the UI state.
 */
export function initializeUIState() {
  const savedFontSize = getStoredValue(STORAGE_KEYS.FONT_SIZE);
  if (savedFontSize) {
    setFontSize(savedFontSize);
  }

  const savedFillColor = getStoredValue(STORAGE_KEYS.FILL_COLOR);
  if (savedFillColor) {
    setFillColor(savedFillColor === FILL_COLOR_DISABLED ? null : savedFillColor);
  }
}

/**
 * Sets up event listeners for UI interactions.
 */
export function setupEventListeners() {
  const insertButton = getButtonElement(DOM_IDS.INSERT_BTN);
  insertButton.onclick = insertOrUpdateFormula;

  const handleCtrlEnter = (event: KeyboardEvent) => {
    if (event.ctrlKey && event.key === "Enter") {
      event.preventDefault();
      void insertOrUpdateFormula();
    }
  };

  const typstInput = getAreaElement(DOM_IDS.TYPST_INPUT);
  typstInput.addEventListener("keydown", handleCtrlEnter);

  const fontSizeInput = getInputElement(DOM_IDS.FONT_SIZE);
  fontSizeInput.addEventListener("keydown", handleCtrlEnter);
}

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
  return getAreaElement(DOM_IDS.TYPST_INPUT).value;
}

/**
 * Sets the Typst code in the UI input.
 */
export function setTypstCode(typstCode: string) {
  getAreaElement(DOM_IDS.TYPST_INPUT).value = typstCode;
}

/**
 * Updates the button text based on whether a Typst shape is selected.
 */
export function setButtonText(isEditingExistingFormula: boolean) {
  const button = getHTMLElement(DOM_IDS.INSERT_BTN) as HTMLButtonElement;
  button.innerHTML = isEditingExistingFormula ? BUTTON_TEXT.UPDATE : BUTTON_TEXT.INSERT;
}

/**
 * Enables or disables the insert button.
 */
export function setButtonEnabled(enabled: boolean) {
  const button = getHTMLElement(DOM_IDS.INSERT_BTN) as HTMLButtonElement;
  button.disabled = !enabled;
}
