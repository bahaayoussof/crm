// Content-based file type detection for the strict attachment allowlist.
// This is signature/allowlist validation, NOT malware scanning (no scanner is
// configured). The client MIME type, extension, and multipart filename are never
// trusted.

import type { AllowedMimeType } from "./attachment.constants.js";

function startsWith(buffer: Buffer, signature: number[], offset = 0): boolean {
  if (buffer.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (buffer[offset + i] !== signature[i]) return false;
  }
  return true;
}

const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const RIFF = [0x52, 0x49, 0x46, 0x46]; // RIFF
const WEBP = [0x57, 0x45, 0x42, 0x50]; // WEBP
const UTF8_BOM = [0xef, 0xbb, 0xbf];

/** True when the buffer begins with any recognized binary container signature. */
function hasBinarySignature(buffer: Buffer): boolean {
  return (
    startsWith(buffer, JPEG) ||
    startsWith(buffer, PNG) ||
    startsWith(buffer, PDF) ||
    (startsWith(buffer, RIFF) && startsWith(buffer, WEBP, 8)) ||
    // Other common binary leading bytes we still want to reject as "text".
    startsWith(buffer, [0x25, 0x50, 0x44, 0x46]) || // %PDF without dash
    startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) || // ZIP / OOXML
    startsWith(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWith(buffer, [0x50, 0x4b, 0x07, 0x08]) ||
    startsWith(buffer, [0x1f, 0x8b]) || // gzip
    startsWith(buffer, [0x52, 0x61, 0x72, 0x21]) || // RAR
    startsWith(buffer, [0x37, 0x7a, 0xbc, 0xaf]) || // 7z
    startsWith(buffer, [0x7f, 0x45, 0x4c, 0x46]) || // ELF
    startsWith(buffer, [0x4d, 0x5a]) || // PE / DOS
    startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0]) // legacy OLE (doc/xls/ppt)
  );
}

// Active-content / markup document starts that must never be accepted as text/plain.
const MARKUP_STARTS = ["<!doctype", "<html", "<head", "<body", "<script", "<svg", "<?xml", "<!--"];

/**
 * Full-buffer validation for text/plain: reject NUL bytes, invalid UTF-8, any
 * recognized binary signature, and HTML/SVG/XML markup intended as active
 * content. The buffer is already bounded to MAX_ATTACHMENT_BYTES by the parser.
 */
function isPlainText(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  if (hasBinarySignature(buffer)) return false;

  let body = buffer;
  if (startsWith(body, UTF8_BOM)) body = body.subarray(3);

  if (body.includes(0x00)) return false;

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(body);
  } catch {
    return false;
  }

  const lead = text.replace(/^[\s]+/, "").slice(0, 64).toLowerCase();
  if (MARKUP_STARTS.some((marker) => lead.startsWith(marker))) return false;

  return true;
}

/**
 * Detect the stored MIME type from file content. Returns one of the allowlisted
 * types, or `null` when the content does not match any allowed type.
 */
export function detectFileType(buffer: Buffer): AllowedMimeType | null {
  if (buffer.length === 0) return null;
  if (startsWith(buffer, JPEG)) return "image/jpeg";
  if (startsWith(buffer, PNG)) return "image/png";
  if (startsWith(buffer, RIFF) && startsWith(buffer, WEBP, 8)) return "image/webp";
  if (startsWith(buffer, PDF)) return "application/pdf";
  if (isPlainText(buffer)) return "text/plain";
  return null;
}
