/**
 * Drag and drop event handlers for file selection.
 */

import "./types.js";
import { getHTMLElement } from "../utils/dom.js";
import { processFile, handleFileInputChange } from "./picker.js";

/**
 * Handles drag over event.
 */
function handleDragOver(event: DragEvent): void {
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
function handleDragLeave(event: DragEvent): void {
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
async function handleDrop(event: DragEvent): Promise<void> {
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
    // FileSystemFileHandle not supported, fallback to regular File object
    const file = fileItem.getAsFile();
    if (file) {
      processFile(file);
    }
  }
}

/**
 * Initializes the dropzone event listeners.
 */
export function initializeDropzone(): void {
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
