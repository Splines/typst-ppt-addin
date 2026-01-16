import { typst } from "./typst.js";
import { storeValue } from "./state.js";
import { applyFillColor, applySize } from "./svg.js";

/**
 * Sets the status message in the UI.
 */
export function setStatus(message: string, isError = false) {
  const statusElement = document.getElementById("status") as HTMLElement;
  statusElement.textContent = message || "";
  statusElement.classList.toggle("error", isError);
}

/**
 * @returns the current font size from the UI
 */
export function getFontSize(): string {
  const fontSizeInput = document.getElementById("fontSize");
  return (fontSizeInput as HTMLInputElement).value;
}

/**
 * Sets the font size in the UI.
 */
export function setFontSize(fontSize: string) {
  const fontSizeInput = document.getElementById("fontSize");
  (fontSizeInput as HTMLInputElement).value = fontSize;
}

/**
 * @returns Fill color value or null if disabled
 */
export function getFillColor(): string {
  const checkbox = document.getElementById("fillColorEnabled") as HTMLInputElement;
  const enabled = checkbox.checked;
  if (!enabled) return "";

  const fillColorInput = document.getElementById("fillColor") as HTMLInputElement;
  return fillColorInput.value || "#000000";
}

/**
 * Sets the fill color in the UI.
 *
 * @param color Fill color to set, or null to disable
 */
export function setFillColor(color: string | null) {
  const fillColorInput = document.getElementById("fillColor") as HTMLInputElement;
  const checkbox = document.getElementById("fillColorEnabled") as HTMLInputElement;

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
  const typstInput = document.getElementById("typstInput") as HTMLInputElement;
  return typstInput.value;
}

/**
 * Sets the Typst code in the UI input.
 */
export function setTypstCode(typstCode: string) {
  const typstInput = document.getElementById("typstInput") as HTMLInputElement;
  typstInput.value = typstCode;
}

/**
 * Updates the button text based on whether a Typst shape is selected.
 */
export function setButtonText(isEditingExistingFormula: boolean) {
  const button = document.getElementById("insertBtn") as HTMLButtonElement;
  button.innerText = isEditingExistingFormula ? "Update (Ctrl+Enter)" : "Insert (Ctrl+Enter)";
}

/**
 * Enables or disables the insert button.
 */
export function setButtonEnabled(enabled: boolean) {
  const button = document.getElementById("insertBtn") as HTMLButtonElement;
  button.disabled = !enabled;
}

/**
 * Updates the preview panel with compiled SVG.
 */
export async function updatePreview() {
  const rawCode = getTypstCode().trim();
  const fontSize = getFontSize();
  const previewElement = document.getElementById("previewContent") as HTMLElement;

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

  const { svgElement: processedSvg } = applySize(svgOutput);
  previewElement.innerHTML = processedSvg.outerHTML;
  previewElement.style.color = "";

  const svgElement = previewElement.querySelector("svg");
  if (!svgElement) return;

  svgElement.style.width = "100%";
  svgElement.style.height = "auto";
  svgElement.style.maxHeight = "150px";

  const fillColor = getFillColor();
  if (fillColor) {
    const isDarkMode = !document.documentElement.classList.contains("light-mode");
    const previewFill = isDarkMode ? "#ffffff" : "#000000";
    applyFillColor(svgElement, previewFill);
  }
}

/**
 * Sets up event listeners for preview updates.
 */
export function setupPreviewListeners() {
  const typstInput = document.getElementById("typstInput") as HTMLInputElement;
  const fontSizeInput = document.getElementById("fontSize") as HTMLInputElement;
  const fillColorInput = document.getElementById("fillColor") as HTMLInputElement;
  const fillColorEnabled = document.getElementById("fillColorEnabled") as HTMLInputElement;

  typstInput.addEventListener("input", () => {
    void updatePreview();
  });

  fontSizeInput.addEventListener("input", () => {
    const fontSize = getFontSize();
    storeValue("typstFontSize", fontSize);
    void updatePreview();
  });

  fillColorInput.addEventListener("input", () => {
    const fillColor = getFillColor();
    storeValue("typstFillColor", fillColor);
    void updatePreview();
  });

  fillColorEnabled.addEventListener("change", () => {
    const fillColor = getFillColor();
    const colorInput = document.getElementById("fillColor") as HTMLInputElement;
    colorInput.disabled = !fillColorEnabled.checked;
    storeValue("typstFillColor", fillColor || "disabled");
    void updatePreview();
  });
}

/**
 * Initializes dark mode based on stored preference (defaults to dark mode).
 */
export function initializeDarkMode() {
  const darkModeToggle = document.getElementById("darkModeToggle") as HTMLInputElement;
  const isDarkMode = isDarkModeEnabled();

  darkModeToggle.checked = isDarkMode;
  applyTheme(isDarkMode);
}

/**
 * @returns whether dark mode is enabled
 */
function isDarkModeEnabled(): boolean {
  const savedTheme = localStorage.getItem("typstTheme");
  return savedTheme === null ? true : savedTheme === "dark";
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
  const darkModeToggle = document.getElementById("darkModeToggle") as HTMLInputElement;
  darkModeToggle.addEventListener("change", (event) => {
    const isDark = (event.target as HTMLInputElement).checked;
    applyTheme(isDark);
    localStorage.setItem("typstTheme", isDark ? "dark" : "light");
    void updatePreview();
  });
}
