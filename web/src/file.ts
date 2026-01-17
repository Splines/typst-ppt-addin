import { insertOrUpdateFormula } from "./insertion.js";
import { setStatus, setTypstCode, getMathModeEnabled, setMathModeEnabled } from "./ui.js";
import { DOM_IDS, STORAGE_KEYS } from "./constants.js";
import { getButtonElement, getHTMLElement } from "./utils/dom.js";
import { storeValue, getStoredValue } from "./utils/storage.js";

// Store the file handle for persistent access
let fileHandle: FileSystemFileHandle | null = null;

// Extend Window interface to include File System Access API
declare global {
  interface Window {
    showOpenFilePicker(_options?: {
      types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
      }>;
      multiple?: boolean;
    }): Promise<FileSystemFileHandle[]>;
  }
}

/**
 * Opens the file picker using File System Access API.
 */
async function pickFile(): Promise<void> {
  try {
    // Use File System Access API to pick a file
    const handles = await window.showOpenFilePicker({
      types: [
        {
          description: "Typst files",
          accept: {
            "text/plain": [".typ", ".txt"],
          },
        },
      ],
      multiple: false,
    });

    if (handles.length > 0) {
      fileHandle = handles[0];
      const file = await fileHandle.getFile();

      // Update UI
      const generateBtn = getButtonElement(DOM_IDS.GENERATE_FROM_FILE_BTN);
      const filePickerLabel = getHTMLElement(DOM_IDS.FILE_PICKER_LABEL);

      generateBtn.style.display = "block";
      filePickerLabel.textContent = `Selected: ${file.name}`;
      filePickerLabel.classList.add("show");
      filePickerLabel.classList.remove("error-state");

      // Store file name for display
      storeValue(STORAGE_KEYS.LAST_FILE_PATH as string, file.name);
    }
  } catch (error) {
    // User cancelled or error occurred
    if ((error as Error).name !== "AbortError") {
      console.error("Error picking file:", error);
    }
  }
}

/**
 * Handles file selection from the file picker.
 */
export function handleFileSelection() {
  // Trigger the File System Access API picker
  void pickFile();
}

/**
 * Handles generating formula from the selected file.
 */
export async function handleGenerateFromFile() {
  if (!fileHandle) {
    setStatus("Please select a file first", true);
    return;
  }

  try {
    // Read the file fresh from disk each time
    const file = await fileHandle.getFile();
    const content = await file.text();

    setTypstCode(content);
    setStatus(`Loaded content from ${file.name}`);

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
    // Clear the file handle if it's no longer accessible
    fileHandle = null;
    getButtonElement(DOM_IDS.GENERATE_FROM_FILE_BTN).style.display = "none";
  }
}

/**
 * Shows the file picker error state when no file is selected.
 */
export function showFilePickerError() {
  const filePickerLabel = getHTMLElement(DOM_IDS.FILE_PICKER_LABEL);

  filePickerLabel.classList.add("error-state", "show");
  filePickerLabel.textContent = "Select a file";
}

/**
 * Clears the file picker error state.
 */
export function clearFilePickerError() {
  const filePickerLabel = getHTMLElement(DOM_IDS.FILE_PICKER_LABEL);

  filePickerLabel.classList.remove("error-state", "show");
}

/**
 * Function to be called from the ribbon button to generate from file.
 *
 * This is registered as a FunctionFile command in manifest.xml.
 */
export function generateFromFile(event: Office.AddinCommands.Event): void {
  try {
    if (!fileHandle) {
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

/**
 * Initializes the file picker with the last used file path.
 */
export function initializeFilePicker() {
  const lastFilePath = getStoredValue(STORAGE_KEYS.LAST_FILE_PATH as string);
  if (!lastFilePath) return;

  const filePickerLabel = getHTMLElement(DOM_IDS.FILE_PICKER_LABEL);
  const generateBtn = getButtonElement(DOM_IDS.GENERATE_FROM_FILE_BTN);

  filePickerLabel.textContent = `Last used: ${lastFilePath}`;
  filePickerLabel.classList.add("show");
  filePickerLabel.classList.remove("error-state");

  // Show generate button if we have a stored file
  generateBtn.style.display = "block";
}
