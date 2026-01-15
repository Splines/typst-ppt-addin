import { getStoredValue } from "./state.js";
import { setFontSize, setFillColor, setupPreviewListeners, initializeDarkMode, setupDarkModeToggle } from "./ui.js";
import { insertOrUpdateFormula, handleSelectionChange } from "./powerpoint.js";
import { initCompiler, initRenderer } from "./compiler.js";

/**
 * Initializes the UI state.
 */
async function initialeUiState() {
  const savedFontSize = getStoredValue("typstFontSize");
  if (savedFontSize) {
    setFontSize(savedFontSize);
  }

  const savedFillColor = getStoredValue("typstFillColor");
  if (savedFillColor) {
    setFillColor(savedFillColor);
  }
}

/**
 * Sets up event listeners for UI interactions
 */
function setupEventListeners() {
  const insertButton = document.getElementById("insertBtn");
  if (insertButton) {
    insertButton.onclick = insertOrUpdateFormula;
  }

  const typstInput = document.getElementById("typstInput");
  if (typstInput) {
    typstInput.addEventListener("keydown", (event) => {
      if (event.ctrlKey && event.key === "Enter") {
        event.preventDefault();
        insertOrUpdateFormula();
      }
    });
  }

  setupPreviewListeners();
}

/**
 * Main initialization function for Office Add-in
 */
Office.onReady(async (info) => {
  if (info.host !== Office.HostType.PowerPoint) {
    return;
  }

  await initCompiler();
  await initRenderer();

  initializeDarkMode();
  setupDarkModeToggle();

  await initialeUiState();
  setupEventListeners();

  Office.context.document.addHandlerAsync(
    Office.EventType.DocumentSelectionChanged,
    handleSelectionChange,
  );

  handleSelectionChange();
});
