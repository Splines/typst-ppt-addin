import { insertOrUpdateFormula } from "./insertion.js";
import { setStatus, setTypstCode, getMathModeEnabled, setMathModeEnabled } from "./ui.js";
import { DOM_IDS, STORAGE_KEYS } from "./constants.js";
import { getButtonElement, getHTMLElement } from "./utils/dom.js";
import { storeValue } from "./utils/storage.js";

// Store the file handle (if available) for fresh reads from disk
let fileHandle: FileSystemFileHandle | null = null;
// Fallback to File object for drag-and-drop without handle support
let selectedFile: File | null = null;

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

  interface DataTransferItem {
    getAsFileSystemHandle(): Promise<FileSystemFileHandle | FileSystemDirectoryHandle>;
  }
}

/**
 * Updates the UI with the selected file information.
 */
function updateFileUI(file: File) {
  const generateBtn = getButtonElement(DOM_IDS.GENERATE_FROM_FILE_BTN);
  generateBtn.style.display = "block";

  const fileInfo = getHTMLElement("fileInfo");
  fileInfo.classList.add("show");

  const fileName = getHTMLElement("fileName");
  fileName.textContent = file.name;

  const fileMeta = getHTMLElement("fileMeta");
  fileMeta.textContent = "Selected";

  const dropzoneLabel = getHTMLElement("dropzoneLabel");
  dropzoneLabel.style.borderColor = "";

  storeValue(STORAGE_KEYS.LAST_FILE_PATH as string, file.name);
}

/**
 * Processes a selected file (from either picker or drop).
 */
function processFile(file: File, handle?: FileSystemFileHandle): void {
  // Check if it's a valid file type
  if (!file.name.endsWith(".typ") && !file.name.endsWith(".txt")) {
    setStatus("Please select a .typ or .txt file", true);
    return;
  }

  fileHandle = handle || null;
  selectedFile = file;
  updateFileUI(file);
  setStatus(`Selected: ${file.name}`);
}

/**
 * Opens the file picker using File System Access API.
 *
 * Falls back to file input if API is not supported.
 */
async function pickFile(): Promise<void> {
  if (!("showOpenFilePicker" in window)) {
    const fileInput = getHTMLElement("fileInput") as HTMLInputElement;
    fileInput.click();
    return;
  }

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
      const handle = handles[0];
      const file = await handle.getFile();
      processFile(file, handle);
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
async function handleDrop(event: DragEvent) {
  event.preventDefault();

  const dropzoneLabel = getHTMLElement("dropzoneLabel");
  dropzoneLabel.classList.remove("drag-over");

  if (!event.dataTransfer?.items) return;

  // Try to get FileSystemFileHandle if supported
  const items = Array.from(event.dataTransfer.items);
  const fileItem = items.find(item => item.kind === "file");

  if (!fileItem) return;

  try {
    // Try to get FileSystemFileHandle (if supported)
    if ("getAsFileSystemHandle" in fileItem) {
      const handle = await fileItem.getAsFileSystemHandle();
      if (handle.kind === "file") {
        const file = await handle.getFile();
        processFile(file, handle);
        return;
      }
    }
  } catch {
    // FileSystemFileHandle not supported, fallback to File object
  }

  // Fallback to regular File object
  const file = fileItem.getAsFile();
  if (file) {
    processFile(file);
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
  dropzoneLabel.addEventListener("drop", (event) => {
    void handleDrop(event);
  });

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
  if (!fileHandle && !selectedFile) {
    setStatus("Please select a file first", true);
    return;
  }

  try {
    // Prefer FileSystemFileHandle for fresh content from disk
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
      return; // Should never happen due to check above
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
    // Handle specific error when file can't be read (common with File objects when file changes)
    if (error instanceof DOMException && error.name === "NotReadableError") {
      setStatus("File has changed on disk. Please select the file again.", true);
      fileHandle = null;
      selectedFile = null;
      getButtonElement(DOM_IDS.GENERATE_FROM_FILE_BTN).style.display = "none";
      const fileInfo = getHTMLElement("fileInfo");
      fileInfo.classList.remove("show");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    setStatus(`Error reading file: ${error}`, true);
    // Clear the file handle and selected file if no longer accessible
    fileHandle = null;
    selectedFile = null;
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
