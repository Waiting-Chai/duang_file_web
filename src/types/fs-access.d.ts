// src/types/fs-access.d.ts

interface FileSystemDirectoryHandle {
  kind: 'directory';
  name: string;
  entries(): AsyncIterable<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
}

interface FileSystemFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: any): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

declare global {
  interface Window {
    showDirectoryPicker(options?: any): Promise<FileSystemDirectoryHandle>;
  }
}

export {};