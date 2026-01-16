import { initializeDarkMode, setupDarkModeToggle, initializeUIState, setupEventListeners } from "./ui.js";
import { handleSelectionChange } from "./powerpoint.js";
import { initTypst } from "./typst.js";

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

  Office.context.document.addHandlerAsync(
    Office.EventType.DocumentSelectionChanged,
    handleSelectionChange,
  );

  await handleSelectionChange();
});
