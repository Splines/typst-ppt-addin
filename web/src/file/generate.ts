/**
 * Main file handling functions and public API.
 */

import { insertOrUpdateFormula } from "../insertion.js";
import { setStatus, setTypstCode, getMathModeEnabled, setMathModeEnabled } from "../ui.js";
import { getFileHandle, getSelectedFile, clearFileState } from "./state.js";
import { showFilePickerError, hideFileUI } from "./ui.js";

/**
 * Handles generating formula from the selected file.
 */
export async function handleGenerateFromFile(): Promise<void> {
  const fileHandle = getFileHandle();
  const selectedFile = getSelectedFile();

  if (!fileHandle && !selectedFile) {
    setStatus("Please select a file first", true);
    return;
  }

  try {
    let content: string;
    let fileName: string;

    if (fileHandle) {
      const file = await fileHandle.getFile();
      content = await file.text();
      fileName = file.name;
    } else if (selectedFile) {
      content = await selectedFile.text();
      fileName = selectedFile.name;
    } else {
      console.error("No file or handle available, should never happen");
      return;
    }

    setTypstCode(content);
    setStatus(`Loaded content from ${fileName}`);

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
    console.error(error);
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    let statusMsg = `Error reading file: ${error}`;

    if (error instanceof DOMException) {
      if (error.name === "NotFoundError") {
        statusMsg = "File couldn't be found on disk anymore. Please select your file again.";
      } else if (error.name === "NotReadableError") {
        statusMsg = "Cannot automatically reload a file that has changed on disk. "
          + "Please select the file again. (This is a limitation when using the file picker "
          + "on browsers that don't support the File System Access API, like Safari.)";
      }
    }
    setStatus(statusMsg, true);

    clearFileState();
    hideFileUI();
  }
}

/**
 * Function to be called from the ribbon button to generate from file.
 *
 * This is registered as a FunctionFile command in manifest.xml.
 */
export async function generateFromFile(event: Office.AddinCommands.Event): Promise<void> {
  try {
    const fileHandle = getFileHandle();
    const selectedFile = getSelectedFile();

    if (!fileHandle && !selectedFile) {
      await Office.addin.showAsTaskpane();
      showFilePickerError();
    } else {
      await handleGenerateFromFile();
    }

    event.completed();
  } catch (error) {
    console.error("Error in generateFromFile command:", error);
    event.completed();
  }
}
