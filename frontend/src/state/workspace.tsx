import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { migrateProfile, type Profile, type Settings, type Workspace } from "../types";

// One saved workspace per user on this browser
const storageKey = (userId: string) => `mp-workspace-v1:${userId}`;

const DEFAULT: Workspace = {
  profile: null,
  source: null,
  importFile: null,
  importMethod: null,
  importWarnings: [],
  noticeClosed: false,
  offer: { text: "" },
  settings: { template: "modern", photo: true, accent: "#0f6e63" },
};

function load(key: string): Workspace {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const w: Workspace = { ...DEFAULT, ...JSON.parse(saved) };
      return w.profile ? { ...w, profile: migrateProfile(w.profile) } : w;
    }
  } catch {
    /* storage unavailable: start fresh */
  }
  return DEFAULT;
}

type Ctx = {
  ws: Workspace;
  update: (fn: (w: Workspace) => Workspace) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  savedAt: number;
};

const WorkspaceContext = createContext<Ctx | null>(null);

export function WorkspaceProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const key = storageKey(userId);
  const [ws, setWs] = useState<Workspace>(() => load(key));
  const [savedAt, setSavedAt] = useState(0);
  const firstRender = useRef(true);

  // Debounced persistence in the browser
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(ws));
      } catch {
        /* quota or private mode */
      }
      setSavedAt(Date.now());
    }, 350);
    return () => clearTimeout(t);
  }, [ws, key]);

  const update = useCallback((fn: (w: Workspace) => Workspace) => setWs(fn), []);
  const updateProfile = useCallback(
    (patch: Partial<Profile>) => setWs((w) => (w.profile ? { ...w, profile: { ...w.profile, ...patch } } : w)),
    [],
  );
  const updateSettings = useCallback(
    (patch: Partial<Settings>) => setWs((w) => ({ ...w, settings: { ...w.settings, ...patch } })),
    [],
  );

  return (
    <WorkspaceContext.Provider value={{ ws, update, updateProfile, updateSettings, savedAt }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
