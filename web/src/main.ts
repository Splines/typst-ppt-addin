import { getStoredValue } from "./state.js";
import { setFontSize, setFillColor, setupPreviewListeners, initializeDarkMode, setupDarkModeToggle } from "./ui.js";
import { insertOrUpdateFormula, handleSelectionChange } from "./powerpoint.js";
import { initTypst } from "./typst.js";

/**
 * Initializes the UI state.
 */
function initializeUIState() {
  const savedFontSize = getStoredValue("typstFontSize");
  if (savedFontSize) {
    setFontSize(savedFontSize);
  }

  const savedFillColor = getStoredValue("typstFillColor");
  if (savedFillColor) {
    setFillColor(savedFillColor === "disabled" ? null : savedFillColor);
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
        void insertOrUpdateFormula();
      }
    });
  }

  setupPreviewListeners();
}

/**
 * Main initialization function for Office Add-in
 */
await Office.onReady(async (info) => {
  if (info.host !== Office.HostType.PowerPoint) {
    return;
  }

  await initTypst();

  initializeDarkMode();
  setupDarkModeToggle();

  initializeUIState();
  setupEventListeners();

  Office.context.document.addHandlerAsync(
    Office.EventType.DocumentSelectionChanged,
    handleSelectionChange,
  );

  await handleSelectionChange();
});
