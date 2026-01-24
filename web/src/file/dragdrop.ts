/**
 * Drag and drop event handlers for file selection.
 */

import "./types.js";
import { getHTMLElement } from "../utils/dom.js";
import { processFile, handleFileInputChange, pickFile } from "./picker.js";
import { DOM_IDS } from "../constants.js";

/**
 * Handles drag over event.
 */
function handleDragOver(event: DragEvent): void {
  event.preventDefault();

  const dropzoneLabel = getHTMLElement(DOM_IDS.DROPZONE_LABEL);
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
function handleDragLeave(event: DragEvent): void {
  const dropzoneLabel = getHTMLElement(DOM_IDS.DROPZONE_LABEL);
  const relatedTarget = event.relatedTarget as Node;

  // Only remove drag-over if we're actually leaving the dropzone
  if (!dropzoneLabel.contains(relatedTarget)) {
    dropzoneLabel.classList.remove("drag-over");
  }
}

/**
 * Handles drop event.
 */
async function handleDrop(event: DragEvent): Promise<void> {
  event.preventDefault();

  const dropzoneLabel = getHTMLElement(DOM_IDS.DROPZONE_LABEL);
  dropzoneLabel.classList.remove("drag-over");

  if (!event.dataTransfer?.items) return;

  // Try to get FileSystemFileHandle if supported
  const items = Array.from(event.dataTransfer.items);
  const fileItem = items.find(item => item.kind === "file");

  if (!fileItem) {
    console.error("No file item found in drop event");
    return;
  }

  let handle: FileSystemFileHandle | undefined;
  let file: File | null = null;

  // Try to get FileSystemFileHandle first (preferred for re-reading)
  try {
    if ("getAsFileSystemHandle" in fileItem) {
      const fileSystemHandle = await fileItem.getAsFileSystemHandle();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (fileSystemHandle && fileSystemHandle.kind === "file") {
        handle = fileSystemHandle;
        file = await handle.getFile();
      }
    }
  } catch (error) {
    // FileSystemFileHandle not supported or permission denied
    console.log("Could not get FileSystemFileHandle, using File object only:", error);
  }

  if (!file) {
    // Fallback to regular File object if handle approach failed
    file = fileItem.getAsFile();
  }

  if (file) {
    processFile(file, handle);
  } else {
    console.error("Could not retrieve file from drop event");
  }
}

/**
 * Initializes the dropzone event listeners.
 */
export function initializeDropzone(): void {
  const dropzoneLabel = getHTMLElement(DOM_IDS.DROPZONE_LABEL);
  const fileInput = getHTMLElement("fileInput") as HTMLInputElement;
  // Intercept label clicks to use File System Access API when supported
  dropzoneLabel.addEventListener("click", (event) => {
    if (event.target !== fileInput && "showOpenFilePicker" in window) {
      event.preventDefault();
      void pickFile();
    }
  });
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
