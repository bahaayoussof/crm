// Storage abstraction for secure attachments. Controllers and services depend
// only on the `AttachmentStorage` interface, never on the provider SDK directly.
// The concrete provider is a private Vercel Blob store (see vercel-blob-storage.ts).

import { env } from "../../config/env.js";

export interface StoredObjectMetadata {
  /** Content type recorded when the object was stored. */
  contentType: string;
  /** Object size in bytes, from trusted provider metadata. */
  size: number;
}

export interface StoredObject extends StoredObjectMetadata {
  body: Buffer;
}

export interface AttachmentStorage {
  /** Store bytes under an unpredictable server-generated key in the private store. */
  put(key: string, bytes: Buffer, options: { contentType: string }): Promise<void>;
  /** Read trusted metadata (size, content type). Throws StorageObjectNotFoundError when absent. */
  head(key: string): Promise<StoredObjectMetadata>;
  /** Retrieve bytes. Throws StorageObjectNotFoundError when absent. Callers bound size via head() first. */
  get(key: string): Promise<StoredObject>;
  /** Best-effort delete for orphan cleanup. Must resolve quietly when the object is already gone. */
  remove(key: string): Promise<void>;
}

/** Raised when no private storage is configured. Never leaks provider detail. */
export class StorageUnavailableError extends Error {
  constructor(message = "Attachment storage is not configured") {
    super(message);
    this.name = "StorageUnavailableError";
  }
}

/** Raised when a stored object referenced by valid attachment metadata cannot be found. */
export class StorageObjectNotFoundError extends Error {
  constructor(message = "Stored attachment object was not found") {
    super(message);
    this.name = "StorageObjectNotFoundError";
  }
}

let override: AttachmentStorage | null = null;
let cached: AttachmentStorage | null = null;

/**
 * Resolve the active storage adapter.
 * Throws {@link StorageUnavailableError} when private storage is not configured;
 * the attachment service maps that to a structured localized 503 response.
 * There is no fallback to public storage or local disk.
 */
export async function getAttachmentStorage(): Promise<AttachmentStorage> {
  if (override) return override;
  if (!env.BLOB_READ_WRITE_TOKEN) throw new StorageUnavailableError();
  if (cached) return cached;
  const { createVercelBlobStorage } = await import("./vercel-blob-storage.js");
  cached = createVercelBlobStorage(env.BLOB_READ_WRITE_TOKEN);
  return cached;
}

/** Test hook: install a deterministic in-memory adapter. */
export function __setAttachmentStorageForTests(storage: AttachmentStorage | null): void {
  override = storage;
  cached = null;
}
