import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../state/auth";
import { WorkspaceProvider } from "../state/workspace";
import "../styles/auth.css";

/** Protects /app: redirects to /login, and gives each user their own workspace. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (user === undefined) {
    return <div className="auth-loading"><div className="spinner" /></div>;
  }
  if (user === null) {
    return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />;
  }
  return (
    <WorkspaceProvider key={user.id} userId={user.id}>
      {children}
    </WorkspaceProvider>
  );
}
