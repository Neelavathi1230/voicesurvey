import { Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../services/api";

export default function NewSurveyPage() {
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState([""]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const qs = questions.map((q) => q.trim()).filter(Boolean);
    if (qs.length === 0) { setError("Add at least one question."); return; }
    setBusy(true); setError("");
    try { await api.createSurvey(title, description, qs); nav("/surveys"); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not create the survey."); }
    finally { setBusy(false); }
  }

  const field = "w-full rounded-lg border border-ink/20 bg-white px-3 py-2.5";
  return (
    <form onSubmit={submit} className="mx-auto h-full max-w-2xl space-y-4 overflow-y-auto p-4 md:p-8">
      <h1 className="font-display text-2xl font-bold">New survey</h1>
      <label className="block text-sm font-medium">Title
        <input className={field} required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block text-sm font-medium">Description (optional)
        <textarea className={field} rows={2} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Questions (open-ended works best for spoken answers)</legend>
        {questions.map((q, i) => (
          <div key={i} className="flex gap-2">
            <input className={field} maxLength={300} aria-label={`Question ${i + 1}`} placeholder={`Question ${i + 1}`} value={q}
              onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? e.target.value : x)))} />
            {questions.length > 1 && (
              <button type="button" aria-label={`Remove question ${i + 1}`} onClick={() => setQuestions(questions.filter((_, j) => j !== i))} className="p-2 opacity-60 hover:opacity-100"><X size={16} /></button>
            )}
          </div>
        ))}
        {questions.length < 20 && (
          <button type="button" onClick={() => setQuestions([...questions, ""])} className="flex items-center gap-1.5 text-sm underline"><Plus size={14} /> Add question</button>
        )}
      </fieldset>
      {error && <p role="alert" className="text-sm text-coral">{error}</p>}
      <button disabled={busy} className="rounded-lg bg-spruce px-5 py-2.5 font-medium text-mist disabled:opacity-50">{busy ? "Creating…" : "Create survey"}</button>
    </form>
  );
}
