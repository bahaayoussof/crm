// Private Vercel Blob adapter for AttachmentStorage.
// Verified against @vercel/blob@2.8.0 installed type declarations:
//  - put(pathname, body, { access: 'private' | 'public', contentType?, addRandomSuffix?, allowOverwrite?, token? })
//  - head(pathname, { token? }) -> { size, contentType, ... }        (throws BlobNotFoundError)
//  - get(pathname, { access: 'private' | 'public', token? }) -> GetBlobResult | null
//        200 -> { statusCode: 200, stream: ReadableStream<Uint8Array>, blob: { contentType, size } }
//  - del(pathname | pathname[], { token? }) -> void
// All four accept a store-relative pathname; the URL is derived from the token's store.
// Access is always 'private'; a raw provider URL or token never leaves the server.

import {
  BlobAccessError,
  BlobNotFoundError,
  BlobServiceNotAvailable,
  BlobServiceRateLimited,
  BlobStoreNotFoundError,
  BlobStoreSuspendedError,
  del,
  get,
  head,
  put,
} from "@vercel/blob";
import { MAX_ATTACHMENT_BYTES } from "./attachment.constants.js";
import {
  type AttachmentStorage,
  type StoredObject,
  type StoredObjectMetadata,
  StorageObjectNotFoundError,
  StorageUnavailableError,
} from "./attachment-storage.js";

function mapProviderError(error: unknown): never {
  if (error instanceof BlobNotFoundError) throw new StorageObjectNotFoundError();
  if (
    error instanceof BlobServiceNotAvailable ||
    error instanceof BlobServiceRateLimited ||
    error instanceof BlobStoreNotFoundError ||
    error instanceof BlobStoreSuspendedError ||
    error instanceof BlobAccessError
  ) {
    throw new StorageUnavailableError();
  }
  throw error;
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        // Defense in depth: callers bound size via head() first.
        if (total > MAX_ATTACHMENT_BYTES) throw new StorageUnavailableError("Stored attachment object exceeds the size limit");
        chunks.push(Buffer.from(value));
      }
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

export function createVercelBlobStorage(token: string): AttachmentStorage {
  return {
    async put(key, bytes, options) {
      try {
        await put(key, bytes, {
          access: "private",
          contentType: options.contentType,
          addRandomSuffix: false,
          allowOverwrite: false,
          token,
        });
      } catch (error) {
        mapProviderError(error);
      }
    },

    async head(key): Promise<StoredObjectMetadata> {
      try {
        const meta = await head(key, { token });
        return { contentType: meta.contentType, size: meta.size };
      } catch (error) {
        mapProviderError(error);
      }
    },

    async get(key): Promise<StoredObject> {
      const result = await get(key, { access: "private", token }).catch(mapProviderError);
      if (!result || result.statusCode !== 200) throw new StorageObjectNotFoundError();
      const body = await drain(result.stream);
      return { body, contentType: result.blob.contentType, size: result.blob.size };
    },

    async remove(key) {
      try {
        await del(key, { token });
      } catch (error) {
        if (error instanceof BlobNotFoundError) return;
        mapProviderError(error);
      }
    },
  };
}
