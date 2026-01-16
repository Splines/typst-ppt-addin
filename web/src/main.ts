import { getStoredValue } from "./state.js";
import { setFontSize, setFillColor, setupPreviewListeners, initializeDarkMode, setupDarkModeToggle } from "./ui.js";
import { insertOrUpdateFormula, handleSelectionChange } from "./powerpoint.js";
import { initTypst } from "./typst.js";
import { STORAGE_KEYS, FILL_COLOR_DISABLED, DOM_IDS } from "./constants.js";

/**
 * Initializes the UI state.
 */
function initializeUIState() {
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
 * Sets up event listeners for UI interactions
 */
function setupEventListeners() {
  const insertButton = document.getElementById(DOM_IDS.INSERT_BTN);
  if (insertButton) {
    insertButton.onclick = insertOrUpdateFormula;
  }

  const typstInput = document.getElementById(DOM_IDS.TYPST_INPUT);
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
