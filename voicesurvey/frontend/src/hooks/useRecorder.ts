import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "requesting" | "recording" | "done" | "failed";
export const MAX_SECONDS = 30;

export function useRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState("");
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const cleanup = useRef<() => void>(() => {});

  const stop = useCallback(() => {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(""); setBlob(null); setSeconds(0); setState("requesting");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser can't record audio. Try a recent Chrome, Edge, Firefox or Safari, or upload a file."); setState("failed"); return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = (e as DOMException).name;
      setError(name === "NotAllowedError" ? "Microphone access was blocked. Allow it in your browser's site settings and try again."
        : name === "NotFoundError" ? "No microphone was found on this device." : "Could not start the microphone.");
      setState("failed"); return;
    }
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += ((v - 128) / 128) ** 2;
      setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
      raf = requestAnimationFrame(tick);
    };
    tick();
    const timer = window.setInterval(() => setSeconds((s) => { if (s + 1 >= MAX_SECONDS) stop(); return s + 1; }), 1000);

    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      cleanup.current();
      setBlob(new Blob(chunks, { type: rec.mimeType }));
      setState("done");
    };
    cleanup.current = () => {
      cancelAnimationFrame(raf); clearInterval(timer); setLevel(0);
      stream.getTracks().forEach((t) => t.stop()); void ctx.close();
    };
    recRef.current = rec;
    rec.start();
    setState("recording");
  }, [stop]);

  const reset = useCallback(() => { setBlob(null); setError(""); setSeconds(0); setState("idle"); }, []);
  useEffect(() => () => { recRef.current?.state === "recording" && recRef.current.stop(); cleanup.current(); }, []);
  return { state, error, level, seconds, blob, start, stop, reset };
}
