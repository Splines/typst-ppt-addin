/**
 * File picker logic using File System Access API.
 */

import "./types.js";
import { getHTMLElement } from "../utils/dom.js";
import { setStatus } from "../ui.js";
import { setFileHandle, setSelectedFile } from "./state.js";
import { updateFileUI } from "./ui.js";
import { DOM_IDS } from "../constants.js";

/**
 * Processes a selected file (from either picker or drop).
 */
export function processFile(file: File, handle?: FileSystemFileHandle): void {
  // Check if it's a valid file type
  if (!file.name.endsWith(".typ") && !file.name.endsWith(".txt")) {
    setStatus("Please select a .typ or .txt file", true);
    return;
  }

  setFileHandle(handle || null);
  setSelectedFile(file);
  updateFileUI(file);
  setStatus(`Selected: ${file.name}`);
}

/**
 * Opens the file picker using File System Access API.
 *
 * Falls back to file input if API is not supported.
 */
export async function pickFile(): Promise<void> {
  if (!("showOpenFilePicker" in window)) {
    const fileInput = getHTMLElement(DOM_IDS.FILE_INPUT) as HTMLInputElement;
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
export function handleFileInputChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const files = input.files;

  if (files && files.length > 0) {
    processFile(files[0]);
    // without this, selecting the same file again wouldn't trigger a change event
    input.value = "";
  }
}
