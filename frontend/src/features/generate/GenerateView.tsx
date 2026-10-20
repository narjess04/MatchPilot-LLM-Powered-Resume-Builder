import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import * as api from "../../api";
import { ProgressModal } from "../../components/ProgressModal";
import { useToast } from "../../components/Toast";
import { IconCheck, IconCopy, IconDoc, IconDownload, IconInfo, IconPen, IconSparkle } from "../../components/icons";
import { toLatex } from "../../lib/latex";
import { cvFileName, printCv } from "../../lib/printCv";
import { useWorkspace } from "../../state/workspace";
import type { CoverLetter, GenMode, Generation, JobAnalysis, KeywordCoverage, Lang } from "../../types";
import { CvSheet } from "../template/CvSheet";
import { ScaledSheet } from "../template/ScaledSheet";
import { TEMPLATES } from "../template/templates";
import { LatexExport } from "../template/TemplateView";

const MIN_OFFER_CHARS = 150;
type Part = "cv" | "letter";

const MODES: { id: GenMode; title: string; desc: string; button: string }[] = [
  { id: "cv", title: "CV seul", desc: "Votre CV réécrit pour cette offre", button: "Générer mon CV" },
  { id: "both", title: "CV + lettre", desc: "Le dossier complet de candidature", button: "Générer mon CV et ma lettre" },
  { id: "letter", title: "Lettre seule", desc: "Une lettre de motivation pour cette offre", button: "Rédiger ma lettre" },
];
const partsOf = (mode: GenMode): Part[] => (mode === "both" ? ["cv", "letter"] : [mode]);

/** The letter as plain text, ready to paste or edit. */
function letterToText(l: CoverLetter, name: string, lang: Lang) {
  const subject = l.subject ? `${lang === "fr" ? "Objet : " : "Subject: "}${l.subject}` : "";
  return [subject, l.greeting, ...l.paragraphs, l.closing, name].filter(Boolean).join("\n\n");
}

export function GenerateView() {
  const { ws, update } = useWorkspace();
  const toast = useToast();
  const g = ws.generation;
  const profile = ws.profile;
  const offerText = ws.offer.text.trim();
  const [busy, setBusy] = useState<Part[] | null>(null);
  const [tab, setTab] = useState<Part>("cv");

  const setGen = (patch: Partial<Generation>) => update((w) => ({ ...w, generation: { ...w.generation, ...patch } }));

  if (!profile || offerText.length < MIN_OFFER_CHARS) {
    return (
      <section className="view">
        <div className="view-head">
          <h1>CV &amp; lettre</h1>
          <p>Il faut d'abord votre profil et l'offre d'emploi.</p>
        </div>
        <div className="card stack">
          <Todo done={!!profile} to="/app/profile" label="Créer ou importer votre profil" />
          <Todo done={offerText.length >= MIN_OFFER_CHARS} to="/app/offer" label="Ajouter l'offre d'emploi (texte ou capture)" />
        </div>
      </section>
    );
  }

  // The analysis is reused as long as the offer text does not change
  const analysis = async (): Promise<JobAnalysis> => {
    if (g.job && g.offerText === offerText) return g.job;
    const job = await api.analyzeOffer(offerText);
    setGen({ job, offerText });
    return job;
  };

  const generate = async (parts: Part[]) => {
    setBusy(parts);
    try {
      const job = await analysis();
      const results = await Promise.allSettled(parts.map(async (part) => {
        if (part === "cv") {
          const cv = await api.tailorCv(profile, job, g.lang);
          setGen({ cv });
        } else {
          const letter = await api.writeCoverLetter(profile, job, g.lang, g.notes);
          setGen({ letter, letterText: letterToText(letter.letter, profile.full_name, g.lang) });
        }
      }));
      const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
      if (failed) toast(failed.reason instanceof Error ? failed.reason.message : "La génération a échoué.");
      if (parts.length === 1) setTab(parts[0]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Analyse de l'offre impossible.");
    } finally {
      setBusy(null);
    }
  };

  const stages = [
    "Analyse de l'offre",
    ...(busy?.includes("cv") ? ["Réécriture du CV pour l'offre", "Vérification : rien d'inventé"] : []),
    ...(busy?.includes("letter") ? ["Rédaction de la lettre", "Relecture du style"] : []),
  ];
  const hasResult = g.cv || g.letter;
  const wanted = partsOf(g.mode);
  const mode = MODES.find((m) => m.id === g.mode)!;
  // Tabs only for what exists; the current tab falls back to the available result
  const shownTab: Part = g[tab] ? tab : g.cv ? "cv" : "letter";
  const job = g.offerText === offerText ? g.job : null;

  return (
    <section className="view">
      {busy && <ProgressModal title="Génération en cours" stages={stages} estimatedMs={busy.length > 1 ? 75_000 : 45_000} />}
      <div className="view-head">
        <h1>CV &amp; lettre</h1>
        <p>Votre CV réécrit pour cette offre et une lettre de motivation, à partir de votre vrai parcours : rien n'est inventé.</p>
      </div>

      <div className="gen-controls card">
        <div>
          <b className="gen-label">Que voulez-vous générer ?</b>
          <div className="gen-modes" role="radiogroup" aria-label="Que générer">
            {MODES.map((m) => (
              <button key={m.id} role="radio" aria-checked={g.mode === m.id} className={`gen-mode${g.mode === m.id ? " on" : ""}`} onClick={() => setGen({ mode: m.id })}>
                <b>{m.title}</b>
                <span>{m.desc}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="gen-row">
          <div>
            <b>Langue du CV et de la lettre</b>
            <span className="small muted">
              {job ? `L'offre est en ${job.language === "fr" ? "français" : "anglais"}.` : "En général, celle de l'offre."}
            </span>
          </div>
          <div className="seg" role="radiogroup" aria-label="Langue">
            {(["fr", "en"] as Lang[]).map((l) => (
              <button key={l} role="radio" aria-checked={g.lang === l} className={g.lang === l ? "on" : ""} onClick={() => setGen({ lang: l })}>
                {l === "fr" ? "Français" : "English"}
              </button>
            ))}
          </div>
        </div>
        {wanted.includes("cv") && (
          <div className="gen-row">
            <div>
              <b>Modèle de CV</b>
              <span className="small muted">{TEMPLATES[ws.settings.template].name}, gardé pour tous vos CV</span>
            </div>
            <Link to="/app/template" className="btn btn-ghost btn-sm">Changer</Link>
          </div>
        )}
        {wanted.includes("letter") && <label className="field">
          <span>Pour la lettre : pourquoi ce poste, cette entreprise ? <em className="muted">(facultatif, mais c'est ce qui la rend personnelle)</em></span>
          <textarea
            rows={3}
            value={g.notes}
            maxLength={2000}
            onChange={(e) => setGen({ notes: e.target.value })}
            placeholder="Ex. : J'ai fait mon PFE sur une plateforme de rendez-vous médicaux, et vous travaillez pour la santé. Disponible dès janvier."
          />
        </label>}
        <div className="gen-actions">
          <button className="btn btn-primary" disabled={!!busy} onClick={() => generate(wanted)}>
            <IconSparkle />{mode.button}
          </button>
          <span className="small muted">{wanted.length > 1 ? "Environ une minute." : "Environ 45 secondes."}</span>
        </div>
      </div>

      {hasResult && (
        <>
          {g.offerText !== offerText && (
            <div className="notice warn">
              <IconInfo />
              <div>L'offre a changé depuis cette génération : régénérez pour l'adapter à la nouvelle offre.</div>
            </div>
          )}
          {g.cv && g.letter && (
            <div className="seg" role="tablist">
              <button role="tab" aria-selected={shownTab === "cv"} className={shownTab === "cv" ? "on" : ""} onClick={() => setTab("cv")}>
                <IconDoc />CV adapté
              </button>
              <button role="tab" aria-selected={shownTab === "letter"} className={shownTab === "letter" ? "on" : ""} onClick={() => setTab("letter")}>
                <IconPen />Lettre de motivation
              </button>
            </div>
          )}
          {shownTab === "cv" ? (
            <CvResult onRegenerate={() => generate(["cv"])} busy={!!busy} />
          ) : (
            <LetterResult onRegenerate={() => generate(["letter"])} busy={!!busy} />
          )}
        </>
      )}
    </section>
  );
}

function Todo({ done, to, label }: { done: boolean; to: string; label: string }) {
  return (
    <div className={`gen-todo${done ? " done" : ""}`}>
      <span className="d">{done && <IconCheck />}</span>
      {done ? <span>{label}</span> : <Link to={to}>{label}</Link>}
    </div>
  );
}

function CvResult({ onRegenerate, busy }: { onRegenerate: () => void; busy: boolean }) {
  const { ws } = useWorkspace();
  const result = ws.generation.cv;
  if (!result) return <Empty label="Le CV n'a pas encore été généré." action="Générer le CV" onClick={onRegenerate} busy={busy} />;
  // The photo is not sent to the server: put it back for the preview
  const profile = { ...result.profile, photo: ws.profile?.photo ?? null };
  const lang = ws.generation.lang;

  return (
    <div className="gen-layout">
      <div className="preview-wrap">
        {ws.settings.template === "latex" && (
          <LatexExport latex={toLatex(profile, ws.settings.accent, lang)} name={profile.full_name} />
        )}
        <div className="preview-head">
          <b>Votre CV pour cette offre</b>
          <div className="gen-actions">
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={onRegenerate}>Régénérer le CV</button>
            <button className="btn btn-primary btn-sm" onClick={() => printCv(profile.full_name)}>
              <IconDownload />Télécharger en PDF
            </button>
          </div>
        </div>
        <p className="small muted gen-pdf-hint">
          Dans la fenêtre qui s'ouvre, choisissez « Enregistrer au format PDF » : le fichier s'appelle {cvFileName(profile.full_name)}.pdf.
        </p>
        <ScaledSheet profile={profile} settings={ws.settings} lang={lang} />
        {/* Full-size copy used only when printing to PDF */}
        {createPortal(<div className="print-root"><CvSheet profile={profile} settings={ws.settings} lang={lang} /></div>, document.body)}
      </div>

      <aside className="stack">
        {ws.generation.job && ws.generation.job.language !== lang ? (
          <div className="notice" style={{ marginBottom: 0 }}>
            <IconInfo />
            <div>Le CV est en {lang === "fr" ? "français" : "anglais"} et l'offre en {lang === "fr" ? "anglais" : "français"} : le taux de mots-clés n'est pas significatif. Pour un logiciel de tri (ATS), gardez la langue de l'offre.</div>
          </div>
        ) : (
          <Coverage before={result.coverage_before} after={result.coverage_after} />
        )}
        {result.warnings.length > 0 && <Warnings items={result.warnings} />}
        {result.changes.length > 0 && (
          <div className="card">
            <h2 className="gen-h">Ce qui a changé</h2>
            <ul className="gen-list">{result.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
        )}
      </aside>
    </div>
  );
}

function Coverage({ before, after }: { before: KeywordCoverage; after: KeywordCoverage }) {
  return (
    <div className="card">
      <h2 className="gen-h">Mots-clés de l'offre</h2>
      <div className="gen-score">
        <span className="muted">{before.percent} %</span>
        <span className="arrow">→</span>
        <b>{after.percent} %</b>
      </div>
      <p className="small muted">Part des mots-clés de l'offre présents dans votre CV, avant et après adaptation. C'est ce que regardent les logiciels de tri (ATS).</p>
      {after.found.length > 0 && (
        <div className="gen-chips">{after.found.map((k) => <span key={k} className="chip ok">{k}</span>)}</div>
      )}
      {after.missing.length > 0 && (
        <>
          <p className="small" style={{ marginTop: 12 }}>
            <b>Absents de votre profil :</b> ils n'ont pas été ajoutés. Si vous les maîtrisez vraiment, ajoutez-les dans <Link to="/app/profile">votre profil</Link> puis régénérez.
          </p>
          <div className="gen-chips">{after.missing.map((k) => <span key={k} className="chip miss">{k}</span>)}</div>
        </>
      )}
    </div>
  );
}

function LetterResult({ onRegenerate, busy }: { onRegenerate: () => void; busy: boolean }) {
  const { ws, update } = useWorkspace();
  const toast = useToast();
  const g = ws.generation;
  if (!g.letter) return <Empty label="La lettre n'a pas encore été rédigée." action="Rédiger la lettre" onClick={onRegenerate} busy={busy} />;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(g.letterText);
      toast("Lettre copiée.");
    } catch {
      toast("Copie impossible : sélectionnez le texte manuellement.");
    }
  };
  const words = g.letterText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="gen-layout">
      <div className="card">
        <div className="card-head">
          <h2>Votre lettre</h2>
          <div className="gen-actions">
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={onRegenerate}>Réécrire</button>
            <button className="btn btn-primary btn-sm" onClick={copy}><IconCopy />Copier</button>
          </div>
        </div>
        <label className="field">
          <textarea
            className="letter-ta"
            value={g.letterText}
            aria-label="Lettre de motivation"
            onChange={(e) => update((w) => ({ ...w, generation: { ...w.generation, letterText: e.target.value } }))}
          />
        </label>
        <div className="small muted" style={{ marginTop: 8 }}>{words} mots · modifiable directement</div>
      </div>
      <aside className="stack">
        {g.letter.warnings.length > 0 && <Warnings items={g.letter.warnings} />}
        <div className="card">
          <h2 className="gen-h">Avant d'envoyer</h2>
          <div className="tips-list">
            <div><IconCheck />Relisez-la à voix haute et changez ce qui ne vous ressemble pas.</div>
            <div><IconCheck />Ajoutez un détail que vous seul·e connaissez : un échange avec l'équipe, un produit que vous utilisez.</div>
            <div><IconCheck />Plus votre note de départ est précise, plus la lettre est personnelle.</div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Warnings({ items }: { items: string[] }) {
  return (
    <div className="notice warn" style={{ marginBottom: 0 }}>
      <IconInfo />
      <div>
        <b>À vérifier</b>
        <ul className="notice-list">{items.map((w, i) => <li key={i}>{w}</li>)}</ul>
      </div>
    </div>
  );
}

function Empty({ label, action, onClick, busy }: { label: string; action: string; onClick: () => void; busy: boolean }) {
  return (
    <div className="card">
      <p className="empty">{label}</p>
      <button className="btn btn-primary btn-sm" disabled={busy} onClick={onClick}>{action}</button>
    </div>
  );
}
