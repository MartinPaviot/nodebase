/**
 * File Processing API — Accepts uploaded files, validates them, and returns
 * processed content (base64 for images, extracted text for PDFs/text files).
 *
 * No persistent storage — files are processed in-memory only.
 */

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { validateFiles, processFiles } from "@/lib/file-processor";

export const maxDuration = 30;

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return Response.json({ error: "No files provided" }, { status: 400 });
    }

    // Validate
    const validation = validateFiles(files);
    if (!validation.valid) {
      return Response.json({ errors: validation.errors }, { status: 400 });
    }

    // Process
    const processed = await processFiles(files);

    return Response.json({ files: processed });
  } catch (error) {
    console.error("File processing error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "File processing failed" },
      { status: 500 },
    );
  }
}
