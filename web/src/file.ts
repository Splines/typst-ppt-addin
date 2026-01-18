import { insertOrUpdateFormula } from "./insertion.js";
import { setStatus, setTypstCode, getMathModeEnabled, setMathModeEnabled } from "./ui.js";
import { DOM_IDS, STORAGE_KEYS } from "./constants.js";
import { getButtonElement, getHTMLElement } from "./utils/dom.js";
import { storeValue, getStoredValue } from "./utils/storage.js";

// Store the file handle in memory
let fileHandle: FileSystemFileHandle | null = null;

// Extend Window and FileSystemHandle interfaces to include File System Access API
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

  interface FileSystemHandle {
    queryPermission(_descriptor?: { mode: "read" | "readwrite" }): Promise<PermissionState>;
    requestPermission(_descriptor?: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  }
}

/**
 * Updates the UI with the selected file information.
 */
function updateFileUI(file: File) {
  const generateBtn = getButtonElement(DOM_IDS.GENERATE_FROM_FILE_BTN);
  const fileInfo = getHTMLElement("fileInfo");
  const fileName = getHTMLElement("fileName");
  const fileMeta = getHTMLElement("fileMeta");
  const dropzoneLabel = getHTMLElement("dropzoneLabel");

  // Update file info
  fileName.textContent = file.name;
  fileMeta.textContent = `${(file.size / 1024).toFixed(1)} KB`;

  // Show file info and hide dropzone label
  fileInfo.classList.add("show");
  dropzoneLabel.style.display = "none";
  generateBtn.style.display = "block";

  // Store file name for display
  storeValue(STORAGE_KEYS.LAST_FILE_PATH as string, file.name);
}

/**
 * Processes a selected file (from either picker or drop).
 */
function processFile(file: File): void {
  // Check if it's a valid file type
  if (!file.name.endsWith(".typ") && !file.name.endsWith(".txt")) {
    setStatus("Please select a .typ or .txt file", true);
    return;
  }

  updateFileUI(file);
  setStatus(`Selected: ${file.name}`);
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
      updateFileUI(file);
    }
  } catch (error) {
    // User cancelled or error occurred
    if ((error as Error).name !== "AbortError") {
      console.error("Error picking file:", error);
    }
  }
}

/**
 * Handles file input change event.
 */
function handleFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = input.files;

  if (files && files.length > 0) {
    processFile(files[0]);
  }
}

/**
 * Handles drag over event.
 */
function handleDragOver(event: DragEvent) {
  event.preventDefault();

  const dropzoneLabel = getHTMLElement("dropzoneLabel");
  if (!event.dataTransfer?.items) return;

  const fileItems = Array.from(event.dataTransfer.items).filter(item => item.kind === "file");

  if (fileItems.length > 0) {
    dropzoneLabel.classList.add("drag-over");

    // Check if it's a valid file type
    const hasValidFile = fileItems.some(item => item.type === "text/plain" || item.type === "");

    event.dataTransfer.dropEffect = hasValidFile ? "copy" : "none";
  }
}

/**
 * Handles drag leave event.
 */
function handleDragLeave(event: DragEvent) {
  const dropzoneLabel = getHTMLElement("dropzoneLabel");
  const relatedTarget = event.relatedTarget as Node;

  // Only remove drag-over if we're actually leaving the dropzone
  if (!dropzoneLabel.contains(relatedTarget)) {
    dropzoneLabel.classList.remove("drag-over");
  }
}

/**
 * Handles drop event.
 */
function handleDrop(event: DragEvent) {
  event.preventDefault();

  const dropzoneLabel = getHTMLElement("dropzoneLabel");
  dropzoneLabel.classList.remove("drag-over");

  if (!event.dataTransfer?.items) return;

  const files = Array.from(event.dataTransfer.items)
    .map(item => item.getAsFile())
    .filter((file): file is File => file !== null);

  if (files.length > 0) {
    processFile(files[0]);
  }
}

/**
 * Initializes the dropzone event listeners.
 */
export function initializeDropzone() {
  const dropzoneLabel = getHTMLElement("dropzoneLabel");
  const fileInput = getHTMLElement("fileInput") as HTMLInputElement;

  fileInput.addEventListener("change", handleFileInputChange);

  dropzoneLabel.addEventListener("dragover", handleDragOver);
  dropzoneLabel.addEventListener("dragleave", handleDragLeave);
  dropzoneLabel.addEventListener("drop", handleDrop);

  // Prevent default drag behavior on window
  window.addEventListener("dragover", (e) => {
    if (!e.dataTransfer?.items) return;
    const fileItems = Array.from(e.dataTransfer.items).filter(item => item.kind === "file");
    if (fileItems.length > 0) {
      e.preventDefault();
    }
  });

  window.addEventListener("drop", (e) => {
    if (!e.dataTransfer?.items) return;
    const fileItems = Array.from(e.dataTransfer.items).filter(item => item.kind === "file");
    if (fileItems.length > 0) {
      e.preventDefault();
    }
  });

  // Try to show last used file
  const lastFilePath = getStoredValue(STORAGE_KEYS.LAST_FILE_PATH as string);
  if (lastFilePath) {
    const fileInfo = getHTMLElement("fileInfo");
    const fileName = getHTMLElement("fileName");
    const fileMeta = getHTMLElement("fileMeta");

    fileName.textContent = lastFilePath;
    fileMeta.textContent = "Previously used";
    fileInfo.classList.add("show");
  }
}

/**
 * Handles file selection from the file picker (kept for compatibility).
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
  const dropzoneLabel = getHTMLElement("dropzoneLabel");
  dropzoneLabel.style.borderColor = "var(--error-color)";
  setStatus("Please select a file first", true);
}

/**
 * Function to be called from the ribbon button to generate from file.
 *
 * This is registered as a FunctionFile command in manifest.xml.
 */
export async function generateFromFile(event: Office.AddinCommands.Event) {
  try {
    if (!fileHandle) {
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
