import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type User = {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  has_password: boolean;
  providers: string[];
};

type Ctx = {
  /** undefined while the session is being checked */
  user: User | null | undefined;
  providers: string[];
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/auth${path}`, { credentials: "same-origin", ...init });
  } catch {
    throw new Error("Serveur injoignable. Le backend est-il lancé ?");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail;
    if (typeof detail === "string") throw new Error(detail);
    if (Array.isArray(detail)) throw new Error(validationMessage(detail));
    throw new Error(`Erreur ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

// FastAPI 422 errors -> readable French message
function validationMessage(errors: { loc: string[]; type: string }[]): string {
  const loc = errors[0]?.loc ?? [];
  const field = loc[loc.length - 1];
  if (field === "email") return "Adresse e-mail invalide.";
  if (field === "password") return "Le mot de passe doit contenir au moins 8 caractères.";
  return "Informations invalides.";
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [providers, setProviders] = useState<string[]>([]);

  useEffect(() => {
    call<User>("/me").then(setUser, () => setUser(null));
    call<{ providers: string[] }>("/providers").then((r) => setProviders(r.providers), () => setProviders([]));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setUser(await call<User>("/login", json({ email, password })));
  }, []);

  const register = useCallback(async (email: string, password: string, full_name: string) => {
    setUser(await call<User>("/register", json({ email, password, full_name })));
  }, []);

  const logout = useCallback(async () => {
    await call<void>("/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, providers, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
