"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";

// Check if Web Speech API is available
const hasSpeechRecognition =
  typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

interface UseVoiceInputOptions {
  /**
   * Called with the full text (baseText + voice transcript) as the user speaks.
   * For Web Speech API: fires on every interim result (real-time).
   * For Whisper fallback: fires once when transcription completes.
   */
  onTranscriptChange: (text: string) => void;
  /** Called when listening ends (silence detected or manually stopped) */
  onListeningEnd?: () => void;
  /** Text already in the input before voice started — used as prefix */
  baseText?: string;
  /** Optional language code (e.g. "fr", "en"). If omitted, auto-detects. */
  language?: string;
}

interface UseVoiceInputReturn {
  /** True when actively listening for speech */
  isListening: boolean;
  /** True only during Whisper fallback transcription */
  isTranscribing: boolean;
  /** Start listening — one click, auto-stops on silence */
  startListening: () => void;
  /** Manually stop listening (optional — silence auto-stops) */
  stopListening: () => void;
  /** Whether real-time transcription is supported (Web Speech API) */
  isRealtimeSupported: boolean;
}

export function useVoiceInput({
  onTranscriptChange,
  onListeningEnd,
  baseText = "",
  language,
}: UseVoiceInputOptions): UseVoiceInputReturn {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Refs to avoid stale closures
  const onTranscriptChangeRef = useRef(onTranscriptChange);
  onTranscriptChangeRef.current = onTranscriptChange;
  const onListeningEndRef = useRef(onListeningEnd);
  onListeningEndRef.current = onListeningEnd;
  const baseTextRef = useRef(baseText);
  baseTextRef.current = baseText;

  // Web Speech API recognition instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  // Whisper fallback
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
      }
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // =============================================
  // Web Speech API (real-time, Chrome/Edge/Safari)
  // =============================================
  const startWebSpeech = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionClass: any =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognitionRef.current = recognition;

    recognition.continuous = false; // auto-stop on silence
    recognition.interimResults = true; // real-time updates
    if (language) {
      recognition.lang = language;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const voiceText = finalTranscript || interimTranscript;
      const base = baseTextRef.current;
      const fullText = base ? base + " " + voiceText : voiceText;
      onTranscriptChangeRef.current(fullText);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      onListeningEndRef.current?.();
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        toast.error("Microphone access denied. Check your browser permissions.");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        toast.error("Voice recognition error. Please try again.");
      }
      setIsListening(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      toast.error("Could not start voice recognition.");
    }
  }, [language]);

  const stopWebSpeech = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop(); // triggers onend → setIsListening(false)
    }
  }, []);

  // =============================================
  // Whisper fallback (Firefox, batch transcription)
  // =============================================
  const transcribeAudio = useCallback(
    async (audioBlob: Blob) => {
      setIsTranscribing(true);
      try {
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");
        if (language) {
          formData.append("language", language);
        }

        const response = await fetch("/api/speech/transcribe", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Transcription failed");
        }

        if (data.text) {
          const base = baseTextRef.current;
          const fullText = base ? base + " " + data.text : data.text;
          onTranscriptChangeRef.current(fullText);
        }
      } catch (error) {
        console.error("Transcription error:", error);
        toast.error("Transcription failed. Please try again.");
      } finally {
        setIsTranscribing(false);
        onListeningEndRef.current?.();
      }
    },
    [language]
  );

  const startWhisperFallback = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        if (audioBlob.size > 0) {
          await transcribeAudio(audioBlob);
        }
      };

      mediaRecorder.start();
      setIsListening(true);

      // Auto-stop after 30 seconds (safety limit for fallback)
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
          setIsListening(false);
        }
      }, 30_000);
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        toast.error("Microphone access denied. Check your browser permissions.");
      } else {
        toast.error("Could not access microphone.");
      }
    }
  }, [transcribeAudio]);

  const stopWhisperFallback = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  }, []);

  // =============================================
  // Public API
  // =============================================
  const startListening = useCallback(() => {
    if (isListening) return;

    if (hasSpeechRecognition) {
      startWebSpeech();
    } else {
      startWhisperFallback();
    }
  }, [isListening, startWebSpeech, startWhisperFallback]);

  const stopListening = useCallback(() => {
    if (hasSpeechRecognition) {
      stopWebSpeech();
    } else {
      stopWhisperFallback();
    }
  }, [stopWebSpeech, stopWhisperFallback]);

  return {
    isListening,
    isTranscribing,
    startListening,
    stopListening,
    isRealtimeSupported: hasSpeechRecognition,
  };
}
