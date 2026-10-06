import type { PublicSurvey, Results, Survey, User } from "../types";

const TOKEN_KEY = "voicesurvey_token";
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError("NETWORK_ERROR", "Can't reach the server. Check your connection and try again.", 0);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new ApiError(body?.error?.code ?? "UNKNOWN", body?.error?.message ?? "Something went wrong.", res.status);
  }
  return body.data as T;
}

export const api = {
  register: (name: string, email: string, password: string) =>
    request<{ token: string; user: User }>("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) }),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request<User>("/auth/me"),
  surveys: () => request<Survey[]>("/surveys"),
  createSurvey: (title: string, description: string, questions: string[]) =>
    request<Survey>("/surveys", { method: "POST", body: JSON.stringify({ title, description, questions }) }),
  setOpen: (id: number, is_open: boolean) => request<Survey>(`/surveys/${id}`, { method: "PATCH", body: JSON.stringify({ is_open }) }),
  deleteSurvey: (id: number) => request<null>(`/surveys/${id}`, { method: "DELETE" }),
  results: (id: number) => request<Results>(`/surveys/${id}/results`),
  async exportCsv(id: number) {
    const res = await fetch(`/api/surveys/${id}/export.csv`, { headers: { Authorization: `Bearer ${tokenStore.get()}` } });
    if (!res.ok) throw new ApiError("EXPORT_FAILED", "Could not export the responses.", res.status);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url; a.download = `survey-${id}-responses.csv`; a.click();
    URL.revokeObjectURL(url);
  },
  publicSurvey: (slug: string) => request<PublicSurvey>(`/public/surveys/${slug}`),
  submitResponse: (slug: string, answers: { question_id: number; transcript: string; input_type: "voice" | "text" }[]) =>
    request<null>(`/public/surveys/${slug}/responses`, { method: "POST", body: JSON.stringify({ answers }) }),
  transcribe: (wav: Blob) => {
    const form = new FormData();
    form.append("file", wav, "answer.wav");
    return request<{ transcript: string; language: string }>("/public/transcribe", { method: "POST", body: form });
  },
};
