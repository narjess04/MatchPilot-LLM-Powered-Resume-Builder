import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../../api";
import { ProgressModal } from "../../components/ProgressModal";
import { useToast } from "../../components/Toast";
import { IconArrow, IconFileUp, IconInfo } from "../../components/icons";
import { SAMPLE_PROFILE } from "../../data/samples";
import { toLatex } from "../../lib/latex";
import { useWorkspace } from "../../state/workspace";
import type { Profile, TemplateId } from "../../types";
import { ScaledSheet } from "./ScaledSheet";
import { ACCENTS, BUILT_IN, TEMPLATES, templateOf } from "./templates";

export function TemplateView() {
  const { ws, updateSettings } = useWorkspace();
  const navigate = useNavigate();
  const profile = ws.profile ?? SAMPLE_PROFILE;
  const s = ws.settings;
  const t = TEMPLATES[templateOf(s)];
  // The colour read from the example is offered next to the usual ones
  const accents = s.custom && !ACCENTS.includes(s.custom.style.accent) ? [s.custom.style.accent, ...ACCENTS] : ACCENTS;

  const photoHint = !t.photo
    ? "Non disponible avec ce modèle"
    : !profile.photo
      ? "Ajoutez une photo dans votre profil"
      : "Courante en France ; à éviter pour les candidatures US/UK";

  return (
    <section className="view">
      <div className="view-head">
        <h1>Modèle de CV</h1>
        <p>Tous les modèles sont compatibles ATS : une colonne, du vrai texte, des titres standards. Choisissez le style qui vous ressemble.</p>
      </div>

      <div className="tpl-layout">
        <div className="tpl-left stack">
          <div className="tpl-grid">
            <ExampleTemplate profile={profile} />
            {BUILT_IN.map((id: TemplateId) => (
              <button key={id} className={`tpl-card${s.template === id ? " on" : ""}`} onClick={() => updateSettings({ template: id })}>
                <ScaledSheet className="thumb" profile={profile} settings={{ ...s, template: id }} crop={0.62} />
                <div className="nm">{TEMPLATES[id].name}<small>{TEMPLATES[id].photo ? "Photo ✓" : "Sans photo"}</small></div>
                <div className="ds">{TEMPLATES[id].desc}</div>
              </button>
            ))}
          </div>

          <div className="card">
            <div className="opt-row">
              <div className="l"><b>Photo de profil</b><span>{photoHint}</span></div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={s.photo && t.photo}
                  disabled={!t.photo}
                  onChange={(e) => updateSettings({ photo: e.target.checked })}
                />
                <span />
              </label>
            </div>
            <div className="opt-row">
              <div className="l"><b>Couleur</b><span>Titres et nom</span></div>
              <div className="swatches">
                {accents.map((c) => (
                  <button
                    key={c}
                    className={`swatch${s.accent === c ? " on" : ""}`}
                    style={{ background: c }}
                    aria-label={`Couleur ${c}`}
                    onClick={() => updateSettings({ accent: c })}
                  />
                ))}
              </div>
            </div>
          </div>
          <p className="small muted">Ce modèle est gardé pour tous vos CV : vous pouvez le changer quand vous voulez.</p>
          <button className="btn btn-primary" onClick={() => navigate("/app/offer")}>Continuer : l'offre d'emploi <IconArrow /></button>
        </div>

        <div className="preview-wrap">
          {templateOf(s) === "latex" && <LatexExport latex={toLatex(profile, s.accent)} name={profile.full_name} />}
          <div className="preview-head">
            <b>Aperçu — {t.name}</b>
            <span className="small muted">
              {ws.profile ? "Aperçu avec les données de votre profil" : "Aperçu avec un profil d'exemple"}
            </span>
          </div>
          <ScaledSheet profile={profile} settings={s} />
        </div>
      </div>
    </section>
  );
}

/** "Mon modèle": the candidate sends a CV they like, its look (typeface, colour, titles…) becomes a template. */
function ExampleTemplate({ profile }: { profile: Profile }) {
  const { ws, updateSettings } = useWorkspace();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const s = ws.settings;
  const custom = s.custom;

  const send = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try {
      const example = await api.templateFromExample(file);
      updateSettings({
        custom: { ...example, fileName: file.name },
        template: "custom",
        accent: example.style.accent,
        photo: example.style.photo !== "none",
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Lecture du CV exemple impossible.");
    } finally {
      setReading(false);
    }
  };

  const remove = () => updateSettings({ custom: null, ...(s.template === "custom" && { template: "modern" as const }) });

  return (
    <>
      {reading && <ProgressModal title="Lecture de votre exemple" stages={["Ouverture du document", "Analyse de la mise en page"]} estimatedMs={12_000} />}
      <input
        ref={input}
        type="file"
        accept=".pdf,image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => { send(e.target.files?.[0]); e.target.value = ""; }}
      />
      {custom ? (
        <div className={`tpl-card tpl-example${s.template === "custom" ? " on" : ""}`}>
          <button className="tpl-example-pick" onClick={() => updateSettings({ template: "custom" })}>
            <figure>
              <img src={custom.preview} alt="Votre CV exemple" />
              <figcaption>Votre exemple</figcaption>
            </figure>
            <IconArrow />
            <figure>
              <ScaledSheet className="thumb" profile={profile} settings={{ ...s, template: "custom" }} crop={0.62} />
              <figcaption>Votre CV</figcaption>
            </figure>
          </button>
          <div className="nm">{TEMPLATES.custom.name}<small>{custom.fileName}</small></div>
          <div className="ds">{custom.style.description || TEMPLATES.custom.desc}</div>
          {custom.notes.map((n, i) => (
            <div key={i} className="ds tpl-example-note"><IconInfo />{n}</div>
          ))}
          <div className="tpl-example-actions">
            <button className="link-btn" onClick={() => input.current?.click()}>Changer d'exemple</button>
            <button className="link-btn muted" onClick={remove}>Retirer</button>
          </div>
        </div>
      ) : (
        <button className="tpl-card tpl-example tpl-example-empty" onClick={() => input.current?.click()}>
          <IconFileUp />
          <div>
            <b>Partir d'un CV que vous aimez</b>
            <span>Envoyez un CV exemple (PDF ou image) : sa police, ses couleurs et ses titres sont repris avec votre contenu.</span>
          </div>
        </button>
      )}
    </>
  );
}

/** Download the .tex source, or open it directly in Overleaf (its "open a snippet" endpoint). */
export function LatexExport({ latex, name }: { latex: string; name: string }) {
  const filename = `CV_${(name || "MatchPilot").normalize("NFKD").replace(/[^\w]+/g, "_").replace(/^_|_$/g, "")}.tex`;

  const download = () => {
    const url = URL.createObjectURL(new Blob([latex], { type: "application/x-tex;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="latex-export">
      <div>
        <b>Code LaTeX prêt à compiler</b>
        <span className="small muted">pdfLaTeX — modifiable dans Overleaf ou tout éditeur LaTeX</span>
      </div>
      <div className="latex-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={download}>Télécharger .tex</button>
        <form action="https://www.overleaf.com/docs" method="post" target="_blank">
          <input type="hidden" name="snip" value={latex} />
          <input type="hidden" name="snip_name" value={filename} />
          <input type="hidden" name="engine" value="pdflatex" />
          <button type="submit" className="btn btn-primary btn-sm">Ouvrir dans Overleaf</button>
        </form>
      </div>
    </div>
  );
}
