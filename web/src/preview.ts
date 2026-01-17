import { DiagnosticMessage, typst } from "./typst.js";
import { applyFillColor, parseAndApplySize } from "./svg.js";
import { DOM_IDS, PREVIEW_CONFIG, STORAGE_KEYS, FILL_COLOR_DISABLED } from "./constants.js";
import { getAreaElement, getHTMLElement, getInputElement } from "./utils/dom";
import { getFillColor, getFontSize, getTypstCode, setButtonEnabled } from "./ui";
import { storeValue } from "./utils/storage.js";

/**
 * Sets up event listeners for preview updates.
 */
export function setupPreviewListeners() {
  const typstInput = getAreaElement(DOM_IDS.TYPST_INPUT);
  const fontSizeInput = getInputElement(DOM_IDS.FONT_SIZE);
  const fillColorInput = getInputElement(DOM_IDS.FILL_COLOR);
  const fillColorEnabled = getInputElement(DOM_IDS.FILL_COLOR_ENABLED);

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
}

/**
 * Updates the preview panel with compiled SVG.
 */
export async function updatePreview() {
  const rawCode = getTypstCode().trim();
  const fontSize = getFontSize();
  const previewElement = getHTMLElement(DOM_IDS.PREVIEW_CONTENT);
  const diagnosticsContainer = getHTMLElement(DOM_IDS.DIAGNOSTICS_CONTAINER);
  const diagnosticsContent = getHTMLElement(DOM_IDS.DIAGNOSTICS_CONTENT);

  if (!rawCode) {
    previewElement.innerHTML = "";
    diagnosticsContainer.style.display = "none";
    return;
  }

  const result = await typst(rawCode, fontSize);

  if (result.diagnostics && result.diagnostics.length > 0) {
    diagnosticsContainer.style.display = "block";
    displayDiagnostics(result.diagnostics, diagnosticsContent);
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
function displayDiagnostics(diagnostics: (string | DiagnosticMessage)[], content: HTMLElement) {
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
    const rangeString = correctDiagnosticRange(diag.range);
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
 */
function correctDiagnosticRange(range: string): string {
  const rangeRegex = /(\d+):(\d+)-(\d+):(\d+)/;
  const match = range.match(rangeRegex);
  if (match) {
    const startLine = parseInt(match[1], 10) - 2;
    const startCol = parseInt(match[2], 10);
    const endLine = parseInt(match[3], 10) - 2;
    const endCol = parseInt(match[4], 10);
    return `${startLine.toString()}:${startCol.toString()}-${endLine.toString()}:${endCol.toString()}`;
  }
  return range;
}
