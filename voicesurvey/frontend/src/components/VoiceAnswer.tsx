import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRecorder } from "../hooks/useRecorder";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { api, ApiError } from "../services/api";
import { toWav16k } from "../utils/audio";

interface Props {
  value: string;
  onChange: (text: string, viaVoice: boolean) => void;
  serverTranscription: boolean;
}

export default function VoiceAnswer({ value, onChange, serverTranscription }: Props) {
  const valueRef = useRef(value);
  valueRef.current = value;
  const append = (t: string) => t && onChange(`${valueRef.current ? valueRef.current + " " : ""}${t}`, true);

  const dictation = useSpeechRecognition(append);
  const rec = useRecorder();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const useServer = !dictation.supported && serverTranscription;

  useEffect(() => {
    if (!useServer || !rec.blob) return;
    let cancelled = false;
    (async () => {
      setProcessing(true); setError("");
      try {
        const res = await api.transcribe(await toWav16k(rec.blob!));
        if (!cancelled) append(res.transcript);
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError || e instanceof Error ? e.message : "Transcription failed. Please type your answer.");
      } finally { if (!cancelled) setProcessing(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.blob]);

  const listening = dictation.state === "listening" || rec.state === "recording";
  const status = listening ? "Listening" : processing ? "Processing" : dictation.state === "failed" || rec.state === "failed" || error ? "Failed" : "Idle";
  const canSpeak = dictation.supported || useServer;
  const toggle = () => {
    if (dictation.supported) return listening ? dictation.stop() : dictation.start();
    return listening ? rec.stop() : void rec.start();
  };
  const message = dictation.error || rec.error || error;

  return (
    <div className="space-y-2">
      {canSpeak ? (
        <div className="flex items-center gap-3">
          <button onClick={toggle} disabled={processing} aria-label={listening ? "Stop dictation" : "Start dictation"}
            className={`grid h-14 w-14 place-items-center rounded-full text-white disabled:opacity-50 ${listening ? "bg-coral" : "bg-spruce"}`}>
            {listening ? <Square size={20} /> : <Mic size={22} />}
          </button>
          <p role="status" aria-live="polite" className="text-sm text-ink/70">
            {status}{listening && dictation.interim ? `: ${dictation.interim}` : ""}
          </p>
        </div>
      ) : (
        <p className="text-sm text-ink/60">Voice input isn't available in this browser. Please type your answer.</p>
      )}
      {message && <p role="alert" className="text-sm text-coral">{message}</p>}
      <textarea value={value} onChange={(e) => onChange(e.target.value, false)} rows={5} maxLength={2000}
        aria-label="Your answer" placeholder="Speak, or type here. You can edit the text before continuing."
        className="w-full rounded-lg border border-ink/20 bg-white p-3" />
    </div>
  );
}
