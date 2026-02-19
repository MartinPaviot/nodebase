import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import OpenAI from "openai";

export const maxDuration = 60; // 1 minute max for transcription

export async function POST(request: Request) {
  try {
    // Authenticate
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Get the audio file from FormData
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return new Response(JSON.stringify({ error: "No audio file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get OpenAI API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "OPENAI_API_KEY environment variable is not configured.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey });

    // Optional language parameter — if omitted, Whisper auto-detects
    const language = formData.get("language") as string | null;

    // Whisper supports webm, mp3, mp4, mpeg, mpga, m4a, wav, and webm
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      ...(language ? { language } : {}),
      response_format: "text",
    });

    return new Response(
      JSON.stringify({
        success: true,
        text: transcription,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Transcription error:", error);

    // Handle specific OpenAI errors
    if (error instanceof OpenAI.APIError) {
      return new Response(
        JSON.stringify({
          error: `OpenAI API error: ${error.message}`,
        }),
        {
          status: error.status || 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to transcribe audio",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
