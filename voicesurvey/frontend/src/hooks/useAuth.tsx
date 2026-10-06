import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, tokenStore } from "../services/api";
import type { User } from "../types";

interface AuthState {
  user: User | null; loading: boolean;
  signIn: (token: string, user: User) => void; signOut: () => void;
}
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  useEffect(() => {
    if (!tokenStore.get()) return;
    api.me().then(setUser).catch(() => tokenStore.clear()).finally(() => setLoading(false));
  }, []);

  const signIn = (token: string, u: User) => { tokenStore.set(token); setUser(u); };
  const signOut = () => { tokenStore.clear(); setUser(null); };
  return <Ctx.Provider value={{ user, loading, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
