import init, { compile_typst, init_fonts } from "../pkg/typst_ppt_engine.js";
import { setCompilerConfig, getStoredValue } from "./state.js";
import { loadCompilerConfig, setupWasm, setWasmFunctions } from "./compiler.js";
import { setStatus, setButtonEnabled, setFontSize, setupPreviewListeners, updatePreview } from "./ui.js";
import { insertOrUpdateFormula, handleSelectionChange } from "./powerpoint.js";
import { debug } from "./utils.js";

/**
 * Initializes the compiler configuration and UI state
 */
async function initializeConfig() {
  const config = await loadCompilerConfig();
  setCompilerConfig(config.url, config.auth);

  if (config.url) {
    debug("Remote compiler configured", config.url);
    setButtonEnabled(true);
    setStatus("Remote compiler ready");
  }

  const savedFontSize = getStoredValue("typstFontSize");
  if (savedFontSize) {
    setFontSize(savedFontSize);
  }
}

/**
 * Initializes the WASM compiler module
 */
async function initializeWasm() {
  setWasmFunctions(init, compile_typst, init_fonts);
  const success = await setupWasm();

  if (success) {
    setButtonEnabled(true);
    setStatus("WASM ready");
    updatePreview();
  } else {
    setStatus("Failed to load WASM. See console for details.", true);
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

  await initializeConfig();
  await initializeWasm();
  setupEventListeners();

  Office.context.document.addHandlerAsync(
    Office.EventType.DocumentSelectionChanged,
    handleSelectionChange,
  );

  handleSelectionChange();
});
