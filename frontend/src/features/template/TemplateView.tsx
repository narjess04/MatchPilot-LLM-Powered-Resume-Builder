import { useNavigate } from "react-router-dom";
import { IconArrow } from "../../components/icons";
import { SAMPLE_PROFILE } from "../../data/samples";
import { toLatex } from "../../lib/latex";
import { useWorkspace } from "../../state/workspace";
import type { TemplateId } from "../../types";
import { ScaledSheet } from "./ScaledSheet";
import { ACCENTS, TEMPLATES } from "./templates";

export function TemplateView() {
  const { ws, updateSettings } = useWorkspace();
  const navigate = useNavigate();
  const profile = ws.profile ?? SAMPLE_PROFILE;
  const s = ws.settings;
  const t = TEMPLATES[s.template];

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
            {(Object.keys(TEMPLATES) as TemplateId[]).map((id) => (
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
                {ACCENTS.map((c) => (
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
          {s.template === "latex" && <LatexExport latex={toLatex(profile, s.accent)} name={profile.full_name} />}
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
