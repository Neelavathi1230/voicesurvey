import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typing: the Web Speech API is not in every TypeScript DOM lib.
interface SpeechRecognitionLike {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((e: any) => void) | null; onerror: ((e: any) => void) | null; onend: (() => void) | null;
  start(): void; stop(): void;
}
type Ctor = new () => SpeechRecognitionLike;
const getCtor = (): Ctor | undefined => (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export type DictationState = "idle" | "listening" | "failed";

/** Browser dictation. Note: Chrome/Edge/Safari may send the audio to their vendor's speech service. */
export function useSpeechRecognition(onFinal: (text: string) => void) {
  const supported = !!getCtor();
  const [state, setState] = useState<DictationState>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  const start = useCallback(() => {
    const C = getCtor();
    if (!C) return;
    setError(""); setInterim("");
    const rec = new C();
    rec.continuous = true; rec.interimResults = true; rec.lang = navigator.language || "en-US";
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current(r[0].transcript.trim()); else live += r[0].transcript;
      }
      setInterim(live);
    };
    rec.onerror = (e) => {
      const map: Record<string, string> = {
        "not-allowed": "Microphone access was blocked. Allow it in your browser's site settings, or type your answer.",
        "service-not-allowed": "Speech recognition is blocked in this browser. Please type your answer.",
        "no-speech": "We didn't hear anything. Try again, or type your answer.",
        "audio-capture": "No microphone was found. Please type your answer.",
        network: "Speech recognition needs an internet connection. Please type your answer.",
      };
      setError(map[e.error] ?? "Speech recognition failed. Please type your answer.");
      setState("failed");
    };
    rec.onend = () => { setInterim(""); setState((s) => (s === "failed" ? s : "idle")); };
    recRef.current = rec;
    rec.start();
    setState("listening");
  }, []);

  const stop = useCallback(() => recRef.current?.stop(), []);
  useEffect(() => () => recRef.current?.stop(), []);
  return { supported, state, interim, error, start, stop };
}
