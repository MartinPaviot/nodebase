import { NextRequest, NextResponse } from "next/server";
import { processTranscript } from "@/lib/meeting-recorder";

// This webhook receives transcripts from recording services (Recall.ai, etc.)
export async function POST(request: NextRequest) {
  const { recordingId, transcript, secret } = await request.json();

  // Verify webhook secret
  if (secret !== process.env.MEETING_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  try {
    const result = await processTranscript(recordingId, transcript);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Failed to process transcript:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
