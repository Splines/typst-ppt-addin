import { typst } from "./typst.js";
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

  const isDarkMode = document.documentElement.classList.contains("dark-mode");
  const previewFill = isDarkMode ? PREVIEW_CONFIG.DARK_MODE_FILL : PREVIEW_CONFIG.LIGHT_MODE_FILL;
  applyFillColor(svgElement, previewFill);
}

/**
 * Updates the insert button enabled state based on whether there's input.
 */
export function updateButtonState() {
  const rawCode = getTypstCode().trim();
  setButtonEnabled(rawCode.length > 0);
}
