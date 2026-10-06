import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../services/api";
import type { Results, SentimentCounts } from "../types";

const COLORS = { positive: "#5E8C7B", neutral: "#8A9A97", negative: "#D6495B" } as const;

function SentimentBar({ s }: { s: SentimentCounts }) {
  const total = s.positive + s.neutral + s.negative;
  if (!total) return <p className="text-sm text-ink/60">No answers yet.</p>;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-ink/10" role="img" aria-label={`${s.positive} positive, ${s.neutral} neutral, ${s.negative} negative`}>
        {(["positive", "neutral", "negative"] as const).map((k) => <div key={k} style={{ width: `${(s[k] / total) * 100}%`, background: COLORS[k] }} />)}
      </div>
      <p className="mt-1 text-xs text-ink/60">{s.positive} positive · {s.neutral} neutral · {s.negative} negative</p>
    </div>
  );
}

const Chips = ({ items }: { items: { term: string; count: number }[] }) => (
  <div className="flex flex-wrap gap-1.5">
    {items.length === 0 ? <span className="text-sm text-ink/60">None yet</span> : items.map((k) => (
      <span key={k.term} className="rounded-full border border-ink/15 px-2.5 py-1 text-xs">{k.term} <span className="text-ink/50">{k.count}</span></span>
    ))}
  </div>
);

export default function ResultsPage() {
  const { id } = useParams();
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.results(Number(id)).then(setData).catch((e) => setError(e instanceof ApiError ? e.message : "Could not load results."));
  }, [id]);

  const card = "rounded-xl bg-white p-4 shadow-sm";
  if (error) return <p role="alert" className="p-8 text-coral">{error}</p>;
  if (!data) return <p className="p-8">Loading…</p>;
  const maxDay = Math.max(1, ...data.per_day.map((d) => d.count));
  return (
    <div className="mx-auto h-full max-w-4xl space-y-4 overflow-y-auto p-4 md:p-8">
      <Link to="/surveys" className="text-sm underline">← Surveys</Link>
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{data.survey.title}</h1>
        <button onClick={() => api.exportCsv(data.survey.id).catch((e) => setError(e.message))}
          className="flex items-center gap-1.5 rounded-lg border border-ink/20 px-3 py-1.5 text-sm"><Download size={14} /> Export CSV</button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Responses", data.total_responses], ["Answers", data.total_answers], ["Spoken", data.voice_answers], ["Typed", data.text_answers]].map(([k, v]) => (
          <div key={k} className={card}><p className="text-sm text-ink/60">{k}</p><p className="font-display text-3xl font-bold">{v}</p></div>
        ))}
      </div>
      <div className={card}><h2 className="mb-2 font-medium">Overall sentiment</h2><SentimentBar s={data.sentiment} />
        <h2 className="mb-2 mt-4 font-medium">Most mentioned</h2><Chips items={data.top_keywords} /></div>
      {data.per_day.length > 0 && (
        <div className={card}>
          <h2 className="mb-3 font-medium">Responses, last 14 days</h2>
          <div className="flex h-28 items-end gap-2">
            {data.per_day.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.count}`}>
                <div className="flex w-full flex-1 items-end"><div className="w-full bg-spruce" style={{ height: `${(d.count / maxDay) * 100}%` }} /></div>
                <span className="text-[10px] text-ink/50">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.questions.map((q, i) => (
        <div key={q.question_id} className={`${card} space-y-3`}>
          <h2 className="font-display text-lg font-bold">{i + 1}. {q.text}</h2>
          <p className="text-sm text-ink/60">{q.answer_count} answers · {q.voice_answers} spoken · avg {q.average_words} words</p>
          <SentimentBar s={q.sentiment} />
          <div><p className="mb-1 text-sm font-medium">Keywords</p><Chips items={q.top_keywords} /></div>
          {q.top_phrases.length > 0 && <div><p className="mb-1 text-sm font-medium">Repeated phrases</p><Chips items={q.top_phrases} /></div>}
          {[["Most negative", q.most_negative], ["Most positive", q.most_positive]].map(([label, items]) =>
            (items as typeof q.most_negative).length > 0 && (
              <div key={label as string}><p className="mb-1 text-sm font-medium">{label as string}</p>
                {(items as typeof q.most_negative).map((e, j) => <blockquote key={j} className="mb-1 border-l-2 border-ink/20 pl-3 text-sm">{e.text}</blockquote>)}</div>
            ))}
        </div>
      ))}
      <p className="text-xs text-ink/50">Sentiment and keywords come from a simple word-list analysis. Read the quotes before drawing conclusions.</p>
    </div>
  );
}
