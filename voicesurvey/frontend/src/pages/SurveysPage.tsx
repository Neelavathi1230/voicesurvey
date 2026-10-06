import { BarChart3, Copy, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../services/api";
import type { Survey } from "../types";

export default function SurveysPage() {
  const [rows, setRows] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<number | null>(null);

  const load = useCallback(async () => {
    try { setRows(await api.surveys()); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Could not load surveys."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const link = (s: Survey) => `${window.location.origin}/s/${s.slug}`;
  async function toggle(s: Survey) { try { await api.setOpen(s.id, !s.is_open); load(); } catch (e) { setError(e instanceof ApiError ? e.message : "Update failed."); } }
  async function remove(s: Survey) {
    if (!window.confirm(`Delete "${s.title}" and all its responses?`)) return;
    try { await api.deleteSurvey(s.id); load(); } catch (e) { setError(e instanceof ApiError ? e.message : "Delete failed."); }
  }

  return (
    <div className="mx-auto h-full max-w-3xl space-y-4 overflow-y-auto p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Your surveys</h1>
        <Link to="/surveys/new" className="rounded-lg bg-spruce px-4 py-2 text-sm font-medium text-mist">New survey</Link>
      </div>
      {error && <p role="alert" className="text-sm text-coral">{error}</p>}
      {loading ? <p className="text-ink/60">Loading…</p> : rows.length === 0 ? (
        <p className="text-ink/60">No surveys yet. Create one and share its link so people can answer by voice.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((s) => (
            <li key={s.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-bold">{s.title}</p>
                  <p className="text-sm text-ink/60">{s.questions.length} questions · {s.response_count ?? 0} responses · {s.is_open ? "Open" : "Closed"}</p>
                </div>
                <button onClick={() => remove(s)} aria-label={`Delete ${s.title}`} className="p-1 opacity-60 hover:opacity-100"><Trash2 size={16} /></button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <Link to={`/surveys/${s.id}/results`} className="flex items-center gap-1.5 rounded-lg bg-signal px-3 py-1.5 font-medium"><BarChart3 size={14} /> Results</Link>
                <button onClick={async () => { await navigator.clipboard?.writeText(link(s)); setCopied(s.id); }}
                  className="flex items-center gap-1.5 rounded-lg border border-ink/20 px-3 py-1.5"><Copy size={14} /> {copied === s.id ? "Copied" : "Copy link"}</button>
                <button onClick={() => toggle(s)} className="rounded-lg border border-ink/20 px-3 py-1.5">{s.is_open ? "Close survey" : "Reopen"}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
