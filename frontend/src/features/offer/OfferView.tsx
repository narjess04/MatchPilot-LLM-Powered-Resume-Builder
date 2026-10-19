import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../../api";
import { useToast } from "../../components/Toast";
import { IconArrow, IconCheck, IconCopy, IconImage } from "../../components/icons";
import { SAMPLE_JOB } from "../../data/samples";
import { useWorkspace } from "../../state/workspace";

const MIN_CHARS = 150;
type Shot = { file: File; url: string };

export function OfferView() {
  const { ws, update } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  const shotInput = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"text" | "shot">("text");
  const [shot, setShot] = useState<Shot | null>(null);
  const [drag, setDrag] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);

  const text = ws.offer.text;
  const setText = (t: string) => update((w) => ({ ...w, offer: { text: t } }));
  const n = text.trim().length;

  const chooseImage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Choisissez une image (PNG ou JPG).");
    setShot({ file, url: URL.createObjectURL(file) });
  };

  // Ctrl+V of a screenshot anywhere on this page
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (!item) return;
      e.preventDefault();
      setTab("shot");
      chooseImage(item.getAsFile() ?? undefined);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  // Free the previous preview URL whenever the image changes
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  const extract = async () => {
    if (!shot) return;
    setExtracting(true);
    try {
      setText(await api.extractOfferFromImage(shot.file));
      setExtracted(true);
      setTab("text");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Extraction impossible.");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <section className="view">
      <div className="view-head">
        <h1>L'offre d'emploi</h1>
        <p>Collez le texte de l'annonce, ou faites simplement une capture d'écran : le contenu est extrait automatiquement.</p>
      </div>

      <div className="offer-grid">
        <div className="card">
          <div className="seg" role="tablist">
            <button role="tab" aria-selected={tab === "text"} className={tab === "text" ? "on" : ""} onClick={() => setTab("text")}>
              <IconCopy />Coller le texte
            </button>
            <button role="tab" aria-selected={tab === "shot"} className={tab === "shot" ? "on" : ""} onClick={() => setTab("shot")}>
              <IconImage />Capture d'écran
            </button>
          </div>

          {tab === "text" ? (
            <div>
              {extracted && (
                <div className="notice">
                  <IconCheck />
                  <div><b>Texte extrait de votre capture.</b> Relisez-le et corrigez si besoin.</div>
                </div>
              )}
              <label className="field">
                <textarea
                  className="offer-ta"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Collez ici l'annonce complète : intitulé, missions, profil recherché…"
                />
              </label>
              <div className="offer-foot small muted">
                <button className="link-btn" onClick={() => setText(SAMPLE_JOB)}>Utiliser une offre d'exemple</button>
                <span>{n > 0 && n < MIN_CHARS ? `${n} / ${MIN_CHARS} caractères minimum` : `${n} caractère${n > 1 ? "s" : ""}`}</span>
              </div>
            </div>
          ) : shot ? (
            <div className="shot-preview">
              <div className={extracting ? "scan" : ""}><img src={shot.url} alt="Capture de l'offre" /></div>
              <div className="shot-bar">
                <button className="link-btn" style={{ color: "var(--muted)" }} onClick={() => setShot(null)}>Changer d'image</button>
                <button className="btn btn-primary btn-sm" disabled={extracting} onClick={extract}>
                  {extracting ? "Extraction…" : "Extraire le texte"}
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`shot-drop${drag ? " drag" : ""}`}
              tabIndex={0}
              role="button"
              onClick={() => shotInput.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), shotInput.current?.click())}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); chooseImage(e.dataTransfer.files[0]); }}
            >
              <div className="o-ico"><IconImage /></div>
              <b>Déposez une capture de l'offre</b>
              <span className="small muted">PNG ou JPG — ou collez-la directement avec <kbd>Ctrl</kbd> + <kbd>V</kbd></span>
            </div>
          )}
          <input
            ref={shotInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => { chooseImage(e.target.files?.[0]); e.target.value = ""; }}
          />
        </div>

        <aside className="stack">
          <div className="card">
            <h2 style={{ fontSize: 16, marginBottom: 14 }}>Pour un meilleur résultat</h2>
            <div className="tips-list">
              <div><IconCheck />Incluez les missions et le profil recherché, pas seulement le titre.</div>
              <div><IconCheck />Une capture par écran : faites-en plusieurs si l'annonce est longue.</div>
              <div><IconCheck />Le CV sera rédigé dans la langue de l'offre (FR ou EN).</div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => navigate("/app/template")}>Choisir mon modèle <IconArrow /></button>
        </aside>
      </div>
    </section>
  );
}
