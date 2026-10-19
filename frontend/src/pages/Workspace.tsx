import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { DEMO_MODE } from "../api";
import { ThemeToggle } from "../components/ThemeToggle";
import { IconBriefcase, IconCheck, IconDoc, IconLogout, IconSparkle, IconUser, LogoMark } from "../components/icons";
import { completion, initials } from "../lib/utils";
import { useAuth } from "../state/auth";
import { useWorkspace } from "../state/workspace";
import "../styles/workspace.css";
import "../styles/cv.css";

const CRUMBS: Record<string, string> = {
  profile: "Préparer · Mon profil",
  offer: "Préparer · Offre d'emploi",
  template: "Préparer · Modèle de CV",
};

export default function Workspace() {
  const { ws, savedAt } = useWorkspace();
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const section = pathname.split("/")[2] ?? "profile";
  const [savedVisible, setSavedVisible] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  useEffect(() => {
    if (!savedAt) return;
    setSavedVisible(true);
    const t = setTimeout(() => setSavedVisible(false), 1400);
    return () => clearTimeout(t);
  }, [savedAt]);

  const p = ws.profile;
  const pct = p ? completion(p).pct : 0;
  const avatar = p?.photo || user?.avatar_url;
  const displayName = user?.full_name || p?.full_name || user?.email || "";
  const done = {
    profile: !!p && pct >= 70,
    offer: ws.offer.text.trim().length >= 150,
    template: !!p,
  };

  const item = (to: keyof typeof done, label: string, icon: ReactNode) => (
    <NavLink to={to} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
      {icon}
      {label}
      {done[to] && <span className="check"><IconCheck /></span>}
    </NavLink>
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="logo"><LogoMark /><span>MatchPilot</span></Link>
        <div className="nav-label">Préparer</div>
        {item("profile", "Mon profil", <IconUser className="i" />)}
        {item("offer", "Offre d'emploi", <IconBriefcase className="i" />)}
        {item("template", "Modèle de CV", <IconDoc className="i" />)}
        <div className="sep" />
        <div className="nav-label">Générer</div>
        <button className="nav-item" disabled>
          <IconSparkle className="i" />
          CV &amp; lettre <span className="badge">Bientôt</span>
        </button>
        <div className="spacer" />
        {user && (
          <div className="me">
            <div className="avatar">
              {avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : initials(displayName)}
            </div>
            <div className="meta" title={`${displayName} — ${user.email}`}>
              <b>{displayName}</b>
              <span>{p ? `Profil à ${pct}%` : user.email}</span>
            </div>
            <button className="icon-btn" aria-label="Se déconnecter" title="Se déconnecter" onClick={logout}>
              <IconLogout />
            </button>
          </div>
        )}
      </aside>

      <div className="main">
        <div className="topbar">
          <span className="crumb">{CRUMBS[section] ?? ""}</span>
          <div className="top-right">
            <span className={`saved${savedVisible ? " show" : ""}`}><IconCheck />Enregistré</span>
            {DEMO_MODE && (
              <span className="demo-pill" title="Certaines fonctions (capture d'offre, LinkedIn) utilisent encore des données d'exemple">
                Mode démo
              </span>
            )}
            <ThemeToggle />
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
