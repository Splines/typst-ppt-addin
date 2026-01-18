/**
 * Type declarations for File System Access API.
 */

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

export {};
