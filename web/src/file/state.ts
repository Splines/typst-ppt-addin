/**
 * File state management.
 * Manages the file handle and selected file.
 */

// Store the file handle (if available) for fresh reads from disk
let fileHandle: FileSystemFileHandle | null = null;
// Fallback to File object for drag-and-drop without handle support
let selectedFile: File | null = null;

export function getFileHandle(): FileSystemFileHandle | null {
  return fileHandle;
}

export function setFileHandle(handle: FileSystemFileHandle | null): void {
  fileHandle = handle;
}

export function getSelectedFile(): File | null {
  return selectedFile;
}

export function setSelectedFile(file: File | null): void {
  selectedFile = file;
}

export function clearFileState(): void {
  fileHandle = null;
  selectedFile = null;
}
