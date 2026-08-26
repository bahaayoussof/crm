// Deterministic in-memory AttachmentStorage for automated tests.
// Never used in production paths; installed only via __setAttachmentStorageForTests.

import {
  type AttachmentStorage,
  type StoredObject,
  type StoredObjectMetadata,
  StorageObjectNotFoundError,
} from "./attachment-storage.js";

interface Entry {
  body: Buffer;
  contentType: string;
}

export interface MemoryStorage extends AttachmentStorage {
  /** Test inspection: current stored keys. */
  keys(): string[];
  /** Test inspection: number of stored objects. */
  size(): number;
  /** Seed an object directly (e.g. to simulate a stored object larger than the limit). */
  seed(key: string, body: Buffer, contentType: string): void;
  /** Force the next put/head/get/remove call to reject with the given error. */
  failNext(op: "put" | "head" | "get" | "remove", error: Error): void;
  clear(): void;
}

export function createMemoryStorage(): MemoryStorage {
  const store = new Map<string, Entry>();
  const failures = new Map<string, Error>();

  const maybeFail = (op: string) => {
    const error = failures.get(op);
    if (error) {
      failures.delete(op);
      throw error;
    }
  };

  return {
    async put(key, bytes, options) {
      maybeFail("put");
      store.set(key, { body: Buffer.from(bytes), contentType: options.contentType });
    },
    async head(key): Promise<StoredObjectMetadata> {
      maybeFail("head");
      const entry = store.get(key);
      if (!entry) throw new StorageObjectNotFoundError();
      return { contentType: entry.contentType, size: entry.body.byteLength };
    },
    async get(key): Promise<StoredObject> {
      maybeFail("get");
      const entry = store.get(key);
      if (!entry) throw new StorageObjectNotFoundError();
      return { body: Buffer.from(entry.body), contentType: entry.contentType, size: entry.body.byteLength };
    },
    async remove(key) {
      maybeFail("remove");
      store.delete(key);
    },
    keys: () => [...store.keys()],
    size: () => store.size,
    seed: (key, body, contentType) => store.set(key, { body: Buffer.from(body), contentType }),
    failNext: (op, error) => failures.set(op, error),
    clear: () => {
      store.clear();
      failures.clear();
    },
  };
}
