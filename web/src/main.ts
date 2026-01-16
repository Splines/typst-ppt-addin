import { initializeUIState, setupEventListeners } from "./ui.js";
import { handleSelectionChange } from "./powerpoint.js";
import { initTypst } from "./typst.js";
import { setupPreviewListeners } from "./preview.js";
import { initializeDarkMode, setupDarkModeToggle } from "./theme.js";

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

  Office.context.document.addHandlerAsync(
    Office.EventType.DocumentSelectionChanged,
    handleSelectionChange,
  );

  await handleSelectionChange();
});
