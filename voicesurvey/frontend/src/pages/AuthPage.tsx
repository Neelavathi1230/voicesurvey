import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { api, ApiError } from "../services/api";

export default function AuthPage() {
  const { user, signIn } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/surveys" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const res = mode === "login"
        ? await api.login(form.email, form.password)
        : await api.register(form.name, form.email, form.password);
      signIn(res.token, res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally { setBusy(false); }
  }

  const field = "w-full rounded-lg border border-ink/20 bg-white px-3 py-2.5";
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-end bg-spruce p-8 text-mist md:p-14">
        <h1 className="font-display text-4xl font-bold leading-tight md:text-5xl">Surveys people can answer out loud.</h1>
        <p className="mt-4 max-w-md text-mist/75">
          Create a survey, share a link, and let respondents speak their answers. See sentiment, keywords and repeated phrases across every response.
        </p>
      </section>
      <section className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <h2 className="font-display text-2xl font-bold">{mode === "login" ? "Log in" : "Create your account"}</h2>
          {mode === "register" && (
            <label className="block text-sm font-medium">Name
              <input className={field} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
          )}
          <label className="block text-sm font-medium">Email
            <input className={field} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="block text-sm font-medium">Password
            <input className={field} type="password" required minLength={mode === "register" ? 8 : 1}
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            {mode === "register" && <span className="text-xs text-ink/60">At least 8 characters.</span>}
          </label>
          {error && <p role="alert" className="text-sm text-coral">{error}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-spruce py-2.5 font-medium text-mist disabled:opacity-60">
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
          <button type="button" className="text-sm underline" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? "New here? Create an account" : "Have an account? Log in"}
          </button>
        </form>
      </section>
    </div>
  );
}
