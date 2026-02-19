/**
 * File Processor — Validates and processes uploaded files for LLM context.
 *
 * Supports:
 * - Images (png, jpg, gif, webp) → base64 for Claude vision
 * - PDF → text extraction via pdf-parse
 * - Text files (txt, csv, json, xml) → UTF-8 string
 *
 * No persistent storage — files are processed in-memory only.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

// ============================================
// TYPES
// ============================================

export interface ProcessedFile {
  name: string;
  type: "image" | "text";
  mimeType: string;
  /** Base64-encoded data (images only) */
  base64Data?: string;
  /** Extracted text content (text files and PDFs) */
  textContent?: string;
  /** Original file size in bytes */
  size: number;
}

// ============================================
// CONSTANTS
// ============================================

const MAX_FILES = 5;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TOTAL_SIZE = 20 * 1024 * 1024; // 20MB

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const TEXT_TYPES = new Set([
  "text/plain",
  "text/csv",
  "application/json",
  "text/xml",
  "application/xml",
]);

const UNSUPPORTED_WARN_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword", // .doc
]);

// ============================================
// VALIDATION
// ============================================

export function validateFiles(files: File[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (files.length === 0) {
    errors.push("No files provided");
    return { valid: false, errors };
  }

  if (files.length > MAX_FILES) {
    errors.push(`Too many files (max ${MAX_FILES})`);
    return { valid: false, errors };
  }

  let totalSize = 0;

  for (const file of files) {
    totalSize += file.size;

    if (UNSUPPORTED_WARN_TYPES.has(file.type)) {
      errors.push(`${file.name}: DOCX/DOC not supported. Please convert to PDF or paste the text.`);
      continue;
    }

    const isImage = IMAGE_TYPES.has(file.type);
    const isText = TEXT_TYPES.has(file.type);
    const isPdf = file.type === "application/pdf";

    if (!isImage && !isText && !isPdf) {
      errors.push(`${file.name}: Unsupported file type (${file.type || "unknown"})`);
      continue;
    }

    if (isImage && file.size > MAX_IMAGE_SIZE) {
      errors.push(`${file.name}: Image too large (max 10MB)`);
    }

    if ((isText || isPdf) && file.size > MAX_TEXT_SIZE) {
      errors.push(`${file.name}: File too large (max 5MB)`);
    }
  }

  if (totalSize > MAX_TOTAL_SIZE) {
    errors.push(`Total size exceeds 20MB`);
  }

  return { valid: errors.length === 0, errors };
}

// ============================================
// PROCESSING
// ============================================

async function processImage(file: File): Promise<ProcessedFile> {
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  return {
    name: file.name,
    type: "image",
    mimeType: file.type,
    base64Data: base64,
    size: file.size,
  };
}

async function processPdf(file: File): Promise<ProcessedFile> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await pdfParse(buffer);

  return {
    name: file.name,
    type: "text",
    mimeType: file.type,
    textContent: result.text.trim(),
    size: file.size,
  };
}

async function processTextFile(file: File): Promise<ProcessedFile> {
  const text = await file.text();

  return {
    name: file.name,
    type: "text",
    mimeType: file.type,
    textContent: text,
    size: file.size,
  };
}

export async function processFiles(files: File[]): Promise<ProcessedFile[]> {
  const results: ProcessedFile[] = [];

  for (const file of files) {
    if (UNSUPPORTED_WARN_TYPES.has(file.type)) {
      continue; // Skip unsupported types (already validated)
    }

    if (IMAGE_TYPES.has(file.type)) {
      results.push(await processImage(file));
    } else if (file.type === "application/pdf") {
      results.push(await processPdf(file));
    } else if (TEXT_TYPES.has(file.type)) {
      results.push(await processTextFile(file));
    }
  }

  return results;
}
