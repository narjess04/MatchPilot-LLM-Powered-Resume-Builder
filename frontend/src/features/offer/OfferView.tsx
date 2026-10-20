import { type DragEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../../api";
import { useToast } from "../../components/Toast";
import { IconArrow, IconCheck, IconCopy, IconImage, IconX } from "../../components/icons";
import { SAMPLE_JOB } from "../../data/samples";
import { useWorkspace } from "../../state/workspace";

const MIN_CHARS = 150;
const MAX_SHOTS = 6; // same limit as the backend
type Shot = { file: File; url: string };

export function OfferView() {
  const { ws, update } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  const shotInput = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"text" | "shot">("text");
  const [shots, setShots] = useState<Shot[]>([]);
  const [drag, setDrag] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);

  const text = ws.offer.text;
  const setText = (t: string) => update((w) => ({ ...w, offer: { text: t } }));
  const n = text.trim().length;

  const shotsRef = useRef(shots);
  shotsRef.current = shots;

  const addImages = (files: (File | null)[]) => {
    const images = files.filter((f): f is File => !!f && f.type.startsWith("image/"));
    if (images.length < files.length) toast("Choisissez des images (PNG ou JPG).");
    const room = MAX_SHOTS - shotsRef.current.length;
    if (images.length > room) toast(`${MAX_SHOTS} captures maximum.`);
    const added = images.slice(0, Math.max(room, 0)).map((file) => ({ file, url: URL.createObjectURL(file) }));
    if (added.length) setShots((prev) => [...prev, ...added]);
  };

  const removeShot = (i: number) =>
    setShots((prev) => {
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, j) => j !== i);
    });

  // Ctrl+V of a screenshot anywhere on this page
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = [...(e.clipboardData?.items ?? [])].filter((i) => i.type.startsWith("image/"));
      if (!items.length) return;
      e.preventDefault();
      setTab("shot");
      addImages(items.map((i) => i.getAsFile()));
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  // Free the preview URLs when leaving the page
  useEffect(() => () => shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

  const dropProps = {
    onDragOver: (e: DragEvent) => { e.preventDefault(); setDrag(true); },
    onDragLeave: () => setDrag(false),
    onDrop: (e: DragEvent) => { e.preventDefault(); setDrag(false); addImages([...e.dataTransfer.files]); },
  };

  const extract = async () => {
    if (!shots.length) return;
    setExtracting(true);
    try {
      setText(await api.extractOfferFromImages(shots.map((s) => s.file)));
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
          ) : shots.length ? (
            <div className={`shot-preview${drag ? " drag" : ""}`} {...dropProps}>
              <div className="shot-list">
                {shots.map((s, i) => (
                  <figure key={s.url} className={`shot-thumb${extracting ? " scan" : ""}`}>
                    <img src={s.url} alt={`Capture ${i + 1}`} />
                    <span className="shot-num">{i + 1}</span>
                    {!extracting && (
                      <button className="shot-remove" aria-label={`Retirer la capture ${i + 1}`} onClick={() => removeShot(i)}>
                        <IconX />
                      </button>
                    )}
                  </figure>
                ))}
                {shots.length < MAX_SHOTS && !extracting && (
                  <button className="shot-add" onClick={() => shotInput.current?.click()}>
                    <IconImage />
                    <span>Ajouter la suite</span>
                  </button>
                )}
              </div>
              <div className="shot-bar">
                <span className="small muted">
                  {shots.length > 1 ? "Les captures sont lues dans l'ordre, les passages en double sont fusionnés." : "Annonce longue ? Ajoutez une capture par écran."}
                </span>
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
              {...dropProps}
            >
              <div className="o-ico"><IconImage /></div>
              <b>Déposez une ou plusieurs captures de l'offre</b>
              <span className="small muted">PNG ou JPG — ou collez-la directement avec <kbd>Ctrl</kbd> + <kbd>V</kbd></span>
            </div>
          )}
          <input
            ref={shotInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => { addImages([...(e.target.files ?? [])]); e.target.value = ""; }}
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
          <button className="btn btn-primary" onClick={() => navigate("/app/generate")}>Continuer : générer <IconArrow /></button>
        </aside>
      </div>
    </section>
  );
}
