/**
 * Commands module for Office add-in ribbon buttons.
 */

import { showFilePickerError } from "./ui.js";
import { DOM_IDS } from "./constants.js";
import { getInputElement, getButtonElement } from "./utils/dom.js";

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

if (typeof Office !== "undefined") {
  Office.actions.associate("generateFromFile", generateFromFile);
}
