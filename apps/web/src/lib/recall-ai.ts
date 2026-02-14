/**
 * Recall.ai Client Library
 *
 * Wraps the Recall.ai REST API for meeting recording, transcription,
 * and bot management. Used by the Meeting Recorder executor.
 *
 * Docs: https://docs.recall.ai/
 */

const RECALL_API_BASE = "https://api.recall.ai/api/v1";

function getApiKey(): string {
  const key = process.env.RECALL_AI_API_KEY;
  if (!key) throw new Error("RECALL_AI_API_KEY environment variable is not set");
  return key;
}

function headers(): HeadersInit {
  return {
    Authorization: `Token ${getApiKey()}`,
    "Content-Type": "application/json",
  };
}

// ---------- Types ----------

export interface RecallBot {
  id: string;
  meeting_url: string;
  bot_name: string;
  status_changes: Array<{
    code: string;
    created_at: string;
    sub_code: string | null;
  }>;
  video_url: string | null;
  metadata: Record<string, unknown>;
}

export interface RecallTranscriptSegment {
  speaker: string;
  speaker_id: number;
  words: Array<{
    text: string;
    start_time: number;
    end_time: number;
  }>;
}

export interface CreateBotParams {
  meetingUrl: string;
  botName?: string;
  joinMessage?: string;
  metadata?: Record<string, unknown>;
}

// ---------- API Functions ----------

export async function createBot({
  meetingUrl,
  botName = "Nodebase Notetaker",
  joinMessage = "Nodebase is recording this meeting for notes and follow-up.",
  metadata = {},
}: CreateBotParams): Promise<RecallBot> {
  const response = await fetch(`${RECALL_API_BASE}/bot/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: botName,
      transcription_options: {
        provider: "default",
      },
      chat: {
        on_bot_join: {
          send_to: "everyone",
          message: joinMessage,
        },
      },
      metadata,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Recall.ai createBot failed (${response.status}): ${error}`);
  }

  return response.json();
}

export async function getBot(botId: string): Promise<RecallBot> {
  const response = await fetch(`${RECALL_API_BASE}/bot/${botId}/`, {
    headers: headers(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Recall.ai getBot failed (${response.status}): ${error}`);
  }

  return response.json();
}

export async function getBotTranscript(botId: string): Promise<RecallTranscriptSegment[]> {
  const response = await fetch(`${RECALL_API_BASE}/bot/${botId}/transcript/`, {
    headers: headers(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Recall.ai getBotTranscript failed (${response.status}): ${error}`);
  }

  return response.json();
}

export async function deleteBot(botId: string): Promise<void> {
  const response = await fetch(`${RECALL_API_BASE}/bot/${botId}/`, {
    method: "DELETE",
    headers: headers(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Recall.ai deleteBot failed (${response.status}): ${error}`);
  }
}

// ---------- Helpers ----------

/**
 * Convert Recall.ai transcript segments to a readable text format
 * with speaker labels and timestamps.
 */
export function formatTranscript(segments: RecallTranscriptSegment[]): string {
  return segments
    .map((segment) => {
      const text = segment.words.map((w) => w.text).join(" ");
      const startTime = segment.words[0]?.start_time ?? 0;
      const minutes = Math.floor(startTime / 60);
      const seconds = Math.floor(startTime % 60);
      const timestamp = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      return `[${timestamp}] ${segment.speaker}: ${text}`;
    })
    .join("\n");
}

/**
 * Get the current status of a Recall.ai bot.
 * Returns the latest status code.
 */
export function getBotStatus(bot: RecallBot): string {
  if (bot.status_changes.length === 0) return "unknown";
  return bot.status_changes[bot.status_changes.length - 1].code;
}
