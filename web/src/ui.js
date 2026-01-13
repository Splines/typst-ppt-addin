import { compile } from "./compiler.js";
import { applySizeToSvg } from "./utils.js";

/**
 * Sets the status message in the UI
 * @param {string} message - Status message to display
 * @param {boolean} isError - Whether this is an error message
 */
export function setStatus(message, isError = false) {
  const statusElement = document.getElementById("status");
  if (!statusElement) return;

  statusElement.textContent = message || "";
  statusElement.classList.toggle("error", !!isError);
}

/**
 * Gets the current font size from the UI
 * @returns {string} Font size value
 */
export function getFontSize() {
  return document.getElementById("fontSize").value || "20";
}

/**
 * Sets the font size in the UI
 * @param {string} fontSize - Font size to set
 */
export function setFontSize(fontSize) {
  const fontSizeInput = document.getElementById("fontSize");
  if (fontSizeInput) {
    fontSizeInput.value = fontSize;
  }
}

/**
 * Gets the Typst code from the UI input
 * @returns {string} Typst source code
 */
export function getTypstCode() {
  return document.getElementById("typstInput").value;
}

/**
 * Sets the Typst code in the UI input
 * @param {string} code - Typst source code
 */
export function setTypstCode(code) {
  const typstInput = document.getElementById("typstInput");
  if (typstInput) {
    typstInput.value = code;
  }
}

/**
 * Updates the button text based on whether a Typst shape is selected
 * @param {boolean} isUpdating - True if updating existing shape
 */
export function setButtonText(isUpdating) {
  const button = document.getElementById("insertBtn");
  if (button) {
    button.innerText = isUpdating ? "Update (Ctrl+Enter)" : "Insert (Ctrl+Enter)";
  }
}

/**
 * Enables or disables the insert button
 * @param {boolean} enabled - Whether button should be enabled
 */
export function setButtonEnabled(enabled) {
  const button = document.getElementById("insertBtn");
  if (button) {
    button.disabled = !enabled;
  }
}

/**
 * Updates the preview panel with compiled SVG
 */
export async function updatePreview() {
  const rawCode = getTypstCode().trim();
  const fontSize = getFontSize();
  const previewElement = document.getElementById("previewContent");

  if (!previewElement) return;

  if (!rawCode) {
    previewElement.innerHTML = "";
    return;
  }

  const fullCode = `#set text(size: ${fontSize}pt)\n${rawCode}`;

  try {
    const svgOutput = await compile(fullCode);

    if (svgOutput && !svgOutput.startsWith("Error:")) {
      const { svg: processedSvg } = applySizeToSvg(svgOutput, null);
      previewElement.innerHTML = processedSvg;
      previewElement.style.color = "";

      const svgElement = previewElement.querySelector("svg");
      if (svgElement) {
        svgElement.style.width = "100%";
        svgElement.style.height = "auto";
        svgElement.style.maxHeight = "150px";
      }
    } else if (svgOutput && svgOutput.startsWith("Error:")) {
      previewElement.innerText = svgOutput;
      previewElement.style.color = "red";
    }
  } catch {
    previewElement.innerText = "";
  }
}

let debounceTimer;

/**
 * Sets up debounced preview updates on input changes
 */
export function setupPreviewListeners() {
  const typstInput = document.getElementById("typstInput");
  const fontSizeInput = document.getElementById("fontSize");

  const debouncedUpdate = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => updatePreview(), 300);
  };

  if (typstInput) {
    typstInput.addEventListener("input", debouncedUpdate);
  }

  if (fontSizeInput) {
    fontSizeInput.addEventListener("input", debouncedUpdate);
  }
}
