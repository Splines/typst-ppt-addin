import { DiagnosticMessage, typst } from "./typst.js";
import { applyFillColor, parseAndApplySize } from "./svg.js";
import { DOM_IDS, PREVIEW_CONFIG, STORAGE_KEYS, FILL_COLOR_DISABLED } from "./constants.js";
import { getAreaElement, getHTMLElement, getInputElement } from "./utils/dom";
import { getFillColor, getFontSize, getMathModeEnabled, getTypstCode, setButtonEnabled, setMathModeEnabled } from "./ui";
import { storeValue, getStoredValue } from "./utils/storage.js";
import { lastTypstShapeId } from "./shape.js";

/**
 * Sets up event listeners for preview updates.
 */
export function setupPreviewListeners() {
  const typstInput = getAreaElement(DOM_IDS.TYPST_INPUT);
  const fontSizeInput = getInputElement(DOM_IDS.FONT_SIZE);
  const fillColorInput = getInputElement(DOM_IDS.FILL_COLOR);
  const fillColorEnabled = getInputElement(DOM_IDS.FILL_COLOR_ENABLED);
  const mathModeEnabled = getInputElement(DOM_IDS.MATH_MODE_ENABLED);

  typstInput.addEventListener("input", () => {
    updateButtonState();
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

  mathModeEnabled.addEventListener("change", () => {
    const mathMode = getMathModeEnabled();
    if (!lastTypstShapeId) {
      // Only save to storage when in insert mode (no shape selected)
      storeValue(STORAGE_KEYS.MATH_MODE, mathMode.toString());
    }
    updateMathModeVisuals();
    void updatePreview();
  });

  updateMathModeVisuals();
}

/**
 * Restores the math mode setting from localStorage.
 */
export function restoreMathModeFromStorage() {
  const savedMathMode = getStoredValue(STORAGE_KEYS.MATH_MODE);
  if (savedMathMode !== null) {
    setMathModeEnabled(savedMathMode === "true");
    updateMathModeVisuals();
    void updatePreview();
  }
}

/**
 * Updates the visual state of the input wrapper based on math mode.
 */
export function updateMathModeVisuals() {
  const mathMode = getMathModeEnabled();
  const inputWrapper = getHTMLElement(DOM_IDS.INPUT_WRAPPER);
  const textarea = getAreaElement(DOM_IDS.TYPST_INPUT);

  if (mathMode) {
    inputWrapper.classList.remove("math-mode-disabled");
    textarea.placeholder = "Enter Typst code, e.g. a^2 + b^2 = c^2";
  } else {
    inputWrapper.classList.add("math-mode-disabled");
    textarea.placeholder = "Enter Typst code, e.g. $ a^2 + b^2 = c^2 $";
  }
}

/**
 * Updates the preview panel with compiled SVG.
 */
export async function updatePreview() {
  const rawCode = getTypstCode().trim();
  const fontSize = getFontSize();
  const mathMode = getMathModeEnabled();
  const previewElement = getHTMLElement(DOM_IDS.PREVIEW_CONTENT);
  const diagnosticsContainer = getHTMLElement(DOM_IDS.DIAGNOSTICS_CONTAINER);
  const diagnosticsContent = getHTMLElement(DOM_IDS.DIAGNOSTICS_CONTENT);

  if (!rawCode) {
    previewElement.innerHTML = "";
    diagnosticsContainer.style.display = "none";
    return;
  }

  const result = await typst(rawCode, fontSize, mathMode);

  if (result.diagnostics && result.diagnostics.length > 0) {
    diagnosticsContainer.style.display = "block";
    displayDiagnostics(result.diagnostics, diagnosticsContent, mathMode);
  } else {
    diagnosticsContainer.style.display = "none";
  }

  if (!result.svg) {
    previewElement.innerHTML = "";
    return;
  }

  const { svgElement: processedSvg } = parseAndApplySize(result.svg);
  previewElement.innerHTML = processedSvg.outerHTML;
  previewElement.style.color = "";

  const svgElement = previewElement.querySelector("svg");
  if (!svgElement) return;

  svgElement.style.width = "100%";
  svgElement.style.height = "auto";
  svgElement.style.maxHeight = PREVIEW_CONFIG.MAX_HEIGHT;

  const isDarkMode = document.documentElement.classList.contains("dark-mode");
  const previewFill = isDarkMode ? PREVIEW_CONFIG.DARK_MODE_FILL : PREVIEW_CONFIG.LIGHT_MODE_FILL;
  applyFillColor(svgElement, previewFill);
}

/**
 * Displays diagnostics in the UI.
 */
function displayDiagnostics(diagnostics: (string | DiagnosticMessage)[], content: HTMLElement, mathMode: boolean) {
  console.log("Displaying diagnostics:", diagnostics);
  content.innerHTML = "";

  diagnostics.forEach((diag, index) => {
    if (typeof diag === "string") {
      const diagElement = document.createElement("div");
      diagElement.className = "diagnostic";
      diagElement.textContent = diag;
      content.appendChild(diagElement);
      return;
    }

    if (index > 0) {
      const separator = document.createElement("hr");
      separator.className = "diagnostic-separator";
      content.appendChild(separator);
    }

    const diagElement = document.createElement("div");
    diagElement.className = `diagnostic diagnostic-${diag.severity.toLowerCase()}`;

    const headerDiv = document.createElement("div");
    headerDiv.className = "diagnostic-header";

    const severitySpan = document.createElement("span");
    severitySpan.className = "diagnostic-severity";
    severitySpan.textContent = diag.severity;

    const rangeSpan = document.createElement("span");
    rangeSpan.className = "diagnostic-range";
    const rangeString = correctDiagnosticRange(diag.range, mathMode);
    rangeSpan.textContent = rangeString;

    headerDiv.appendChild(severitySpan);
    headerDiv.appendChild(rangeSpan);

    const messageSpan = document.createElement("span");
    messageSpan.className = "diagnostic-message";
    messageSpan.textContent = diag.message;

    diagElement.appendChild(headerDiv);
    diagElement.appendChild(messageSpan);

    content.appendChild(diagElement);
  });
}

/**
 * Updates the insert button enabled state based on whether there's input.
 */
export function updateButtonState() {
  const rawCode = getTypstCode().trim();
  setButtonEnabled(rawCode.length > 0);
}

/**
 * Corrects the diagnostic range to account for added lines in the Typst code.
 *
 * See `buildRawTypstString` for details.
 *
 * @param range The range string from the diagnostic
 * @param mathMode Whether math mode is enabled (adds extra line offset)
 */
function correctDiagnosticRange(range: string, mathMode: boolean): string {
  const rangeRegex = /(\d+):(\d+)-(\d+):(\d+)/;
  const match = range.match(rangeRegex);
  if (match) {
    // buildRawTypstString adds 2 lines before user code
    // If mathMode is enabled, it adds one more line for the opening $
    const offset = mathMode ? 3 : 2;
    const startLine = parseInt(match[1], 10) - offset;
    const startCol = parseInt(match[2], 10);
    const endLine = parseInt(match[3], 10) - offset;
    const endCol = parseInt(match[4], 10);
    return `${startLine.toString()}:${startCol.toString()}-${endLine.toString()}:${endCol.toString()}`;
  }
  return range;
}
