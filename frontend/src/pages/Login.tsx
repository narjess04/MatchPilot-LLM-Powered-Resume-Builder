import { useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";
import { IconLinkedIn, LogoMark } from "../components/icons";
import { useAuth } from "../state/auth";
import "../styles/auth.css";

const OAUTH_ERRORS: Record<string, string> = {
  cancelled: "Connexion annulée.",
  state: "La session de connexion a expiré, réessayez.",
  oauth: "Le fournisseur de connexion n'a pas répondu, réessayez.",
  email: "Votre compte ne partage pas d'adresse e-mail : utilisez une autre méthode.",
  email_in_use: "Un compte existe déjà avec cet e-mail. Connectez-vous avec votre mot de passe.",
  provider: "Ce mode de connexion n'est pas disponible.",
};

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
  </svg>
);

export default function Login() {
  const { user, providers, login, register } = useAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">(params.get("mode") === "register" ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState(OAUTH_ERRORS[params.get("error") ?? ""] ?? "");
  const [busy, setBusy] = useState(false);

  const next = params.get("next")?.startsWith("/app") ? params.get("next")! : "/app";
  if (user) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, fullName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  const oauthButton = (provider: "google" | "linkedin", label: string, icon: JSX.Element) => {
    const enabled = providers.includes(provider);
    return enabled ? (
      // Full page navigation: the backend redirects to Google / LinkedIn
      <a className={`btn oauth-btn ${provider}`} href={`/api/auth/${provider}/login`}>{icon}{label}</a>
    ) : (
      <button className={`btn oauth-btn ${provider}`} disabled title="Non configuré sur ce serveur">{icon}{label}</button>
    );
  };

  return (
    <div className="auth-page">
      <div className="auth-top">
        <Link to="/" className="logo"><LogoMark />MatchPilot</Link>
        <ThemeToggle />
      </div>

      <div className="auth-card">
        <h1>{mode === "login" ? "Bon retour !" : "Créer un compte"}</h1>
        <p className="muted">
          {mode === "login" ? "Connectez-vous pour retrouver votre profil et vos CV." : "Gratuit, en quelques secondes."}
        </p>

        <div className="oauth">
          {oauthButton("google", "Continuer avec Google", <GoogleIcon />)}
          {oauthButton("linkedin", "Continuer avec LinkedIn", <IconLinkedIn />)}
        </div>

        <div className="divider"><span>ou avec votre e-mail</span></div>

        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <label className="field">Nom complet
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" placeholder="Prénom Nom" />
            </label>
          )}
          <label className="field">E-mail
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="prenom.nom@email.com" />
          </label>
          <label className="field">Mot de passe
            <input
              type="password" required minLength={mode === "register" ? 8 : undefined}
              value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={mode === "register" ? "8 caractères minimum" : ""}
            />
          </label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Un instant…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
          </button>
        </form>

        <p className="switch-mode">
          {mode === "login" ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
          <button className="link-btn" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? "Créer un compte" : "Se connecter"}
          </button>
        </p>
      </div>
    </div>
  );
}
