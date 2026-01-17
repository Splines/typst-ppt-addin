import { insertOrUpdateFormula } from "./insertion.js";
import { setStatus, setTypstCode, getMathModeEnabled, setMathModeEnabled } from "./ui.js";
import { DOM_IDS } from "./constants.js";
import { getInputElement, getButtonElement, getHTMLElement } from "./utils/dom.js";

/**
 * Handles file selection form the file picker.
 */
export function handleFileSelection() {
  const fileInput = getInputElement(DOM_IDS.FILE_INPUT);
  const generateBtn = getButtonElement(DOM_IDS.GENERATE_FROM_FILE_BTN);
  const filePickerLabel = getHTMLElement(DOM_IDS.FILE_PICKER_LABEL);

  fileInput.classList.remove("error-state");
  filePickerLabel.classList.remove("error-state", "show");

  if (fileInput.files && fileInput.files.length > 0) {
    generateBtn.style.display = "block";
  } else {
    generateBtn.style.display = "none";
  }
}

/**
 * Handles generating formula from the selected file.
 */
export async function handleGenerateFromFile() {
  const fileInput = getInputElement(DOM_IDS.FILE_INPUT);

  if (!fileInput.files || fileInput.files.length === 0) {
    setStatus("Please select a file first", true);
    return;
  }

  const file = fileInput.files[0];

  try {
    const content = await file.text();
    setTypstCode(content);
    setStatus(`Loaded content from ${file.name}`);

    // Clear the file input for next use
    fileInput.value = "";
    getButtonElement(DOM_IDS.GENERATE_FROM_FILE_BTN).style.display = "none";

    // Temporarily disable math mode for file generation
    // since external files typically include their own $ delimiters
    const previousMathMode = getMathModeEnabled();
    setMathModeEnabled(false);

    try {
      await insertOrUpdateFormula();
    } finally {
      // Restore the previous math mode setting
      setMathModeEnabled(previousMathMode);
    }
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    setStatus(`Error reading file: ${error}`, true);
  }
}

/**
 * Shows the file picker error state when no file is selected.
 */
export function showFilePickerError() {
  const fileInput = getInputElement(DOM_IDS.FILE_INPUT);
  const filePickerLabel = getHTMLElement(DOM_IDS.FILE_PICKER_LABEL);

  fileInput.classList.add("error-state");
  filePickerLabel.classList.add("error-state", "show");
}

/**
 * Clears the file picker error state.
 */
export function clearFilePickerError() {
  const fileInput = getInputElement(DOM_IDS.FILE_INPUT);
  const filePickerLabel = getHTMLElement(DOM_IDS.FILE_PICKER_LABEL);

  fileInput.classList.remove("error-state");
  filePickerLabel.classList.remove("error-state", "show");
}

/**
 * Function to be called from the ribbon button to generate from file.
 *
 * This is registered as a FunctionFile command in manifest.xml.
 */
export function generateFromFile(event: Office.AddinCommands.Event): void {
  try {
    const fileInput = getInputElement(DOM_IDS.FILE_INPUT);

    if (!fileInput.files || fileInput.files.length === 0) {
      void Office.addin.showAsTaskpane();

      setTimeout(() => {
        showFilePickerError();
      }, 100);
    } else {
      const generateBtn = getButtonElement(DOM_IDS.GENERATE_FROM_FILE_BTN);
      generateBtn.click();
    }

    event.completed();
  } catch (error) {
    console.error("Error in generateFromFile command:", error);
    event.completed();
  }
}

export function registerGenerateFromFileCommand() {
  Office.actions.associate("generateFromFile", generateFromFile);
}
