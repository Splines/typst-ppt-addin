import { compile } from "./compiler.js";
import { applySizeToSvg } from "./utils.js";
import { storeValue } from "./state.js";

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
 * Gets the current fill color from the UI
 * @returns {string} Fill color value
 */
export function getFillColor() {
  return document.getElementById("fillColor").value || "#000000";
}

/**
 * Sets the fill color in the UI
 * @param {string} color - Fill color to set
 */
export function setFillColor(color) {
  const fillColorInput = document.getElementById("fillColor");
  if (fillColorInput) {
    fillColorInput.value = color;
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

        // Apply white or black fill for preview based on dark mode
        const isDarkMode = !document.documentElement.classList.contains("light-mode");
        const previewFill = isDarkMode ? "#ffffff" : "#000000";
        applyFillToSvgElement(svgElement, previewFill);
      }
    } else if (svgOutput && svgOutput.startsWith("Error:")) {
      previewElement.innerText = svgOutput;
      previewElement.style.color = "red";
    }
  } catch {
    previewElement.innerText = "";
  }
}

/**
 * Applies fill color to SVG element
 * @param {SVGElement} svgElement - The SVG element to modify
 * @param {string} fillColor - The fill color to apply
 */
function applyFillToSvgElement(svgElement, fillColor) {
  // Apply fill to all path, circle, rect, ellipse, polygon, and polyline elements
  const fillableElements = svgElement.querySelectorAll("path, circle, rect, ellipse, polygon, polyline, text");
  fillableElements.forEach((el) => {
    el.setAttribute("fill", fillColor);
  });
}

/**
 * Sets up event listeners for preview updates
 */
export function setupPreviewListeners() {
  const typstInput = document.getElementById("typstInput");
  const fontSizeInput = document.getElementById("fontSize");
  const fillColorInput = document.getElementById("fillColor");

  if (typstInput) {
    typstInput.addEventListener("input", () => {
      updatePreview();
    });
  }

  if (fontSizeInput) {
    fontSizeInput.addEventListener("input", () => {
      const fontSize = getFontSize();
      storeValue("typstFontSize", fontSize);
      updatePreview();
    });
  }

  if (fillColorInput) {
    fillColorInput.addEventListener("input", () => {
      const fillColor = getFillColor();
      storeValue("typstFillColor", fillColor);
      updatePreview();
    });
  }
}

/**
 * Initializes dark mode based on stored preference (defaults to dark mode)
 */
export function initializeDarkMode() {
  const savedTheme = localStorage.getItem("typstTheme");
  const darkModeToggle = document.getElementById("darkModeToggle");

  // Default to dark mode if no preference is saved
  const isDarkMode = savedTheme === null ? true : savedTheme === "dark";

  if (darkModeToggle) {
    darkModeToggle.checked = isDarkMode;
    applyTheme(isDarkMode);
  }
}

/**
 * Applies the theme to the document
 * @param {boolean} isDark - Whether to apply dark theme
 */
function applyTheme(isDark) {
  const root = document.documentElement;
  if (isDark) {
    root.classList.remove("light-mode");
  } else {
    root.classList.add("light-mode");
  }
}

/**
 * Sets up the dark mode toggle listener
 */
export function setupDarkModeToggle() {
  const darkModeToggle = document.getElementById("darkModeToggle");

  if (darkModeToggle) {
    darkModeToggle.addEventListener("change", (event) => {
      const isDark = event.target.checked;
      applyTheme(isDark);
      localStorage.setItem("typstTheme", isDark ? "dark" : "light");
      updatePreview();
    });
  }
}
