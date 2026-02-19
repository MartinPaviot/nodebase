"use client";

import { Microphone, CircleNotch } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface VoiceInputButtonProps {
  /** True when actively listening for speech */
  isListening: boolean;
  /** True during Whisper fallback transcription */
  isTranscribing: boolean;
  /** Called when the button is clicked */
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceInputButton({
  isListening,
  isTranscribing,
  onClick,
  disabled = false,
  className,
}: VoiceInputButtonProps) {
  const isDisabled = disabled || isTranscribing;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      title={
        isTranscribing
          ? "Transcription..."
          : isListening
            ? "Écoute en cours..."
            : "Dicter"
      }
      className={cn(
        "size-7 rounded-lg flex items-center justify-center shrink-0 transition-all",
        isListening
          ? "text-red-500 bg-red-50 ring-1 ring-red-200 animate-pulse"
          : isTranscribing
            ? "text-indigo-500"
            : isDisabled
              ? "text-[#D1D5DB] cursor-not-allowed"
              : "text-[#9CA3AF] hover:text-[#6B7280] hover:bg-black/5",
        className
      )}
    >
      {isTranscribing ? (
        <CircleNotch className="size-3.5 animate-spin" />
      ) : (
        <Microphone className="size-3.5" weight={isListening ? "fill" : "regular"} />
      )}
    </button>
  );
}
