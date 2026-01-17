import { initializeUIState, setupEventListeners } from "./ui.js";
import { initTypst } from "./typst.js";
import { setupPreviewListeners, updateButtonState } from "./preview.js";
import { initializeDarkMode, setupDarkModeToggle } from "./theme.js";
import { handleSelectionChange } from "./selection.js";

/**
 * Main initialization function for Office Add-in.
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
  setupPreviewListeners();
  updateButtonState();

  Office.context.document.addHandlerAsync(
    Office.EventType.DocumentSelectionChanged,
    handleSelectionChange,
  );

  await handleSelectionChange();
});
