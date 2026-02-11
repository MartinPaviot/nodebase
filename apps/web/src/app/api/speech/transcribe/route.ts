import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { decrypt } from "@/lib/encryption";
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

    // Get OpenAI API key - first try environment variable, then user's credential
    let apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      const credential = await prisma.credential.findFirst({
        where: {
          userId: session.user.id,
          type: "OPENAI",
        },
      });

      if (credential) {
        apiKey = decrypt(credential.value);
      }
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "No OpenAI API key configured. Please add an OpenAI credential or set OPENAI_API_KEY environment variable.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey });

    // Convert File to a format OpenAI accepts
    // Whisper supports webm, mp3, mp4, mpeg, mpga, m4a, wav, and webm
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "fr", // Default to French based on user's interface, can be made dynamic
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
