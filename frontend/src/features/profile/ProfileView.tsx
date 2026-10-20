import { useRef, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../components/Toast";
import { IconArrow, IconInfo, IconX } from "../../components/icons";
import { completion, dates, initials, readSquareImage } from "../../lib/utils";
import { useWorkspace } from "../../state/workspace";
import type { Education, Experience, Language, Profile, Project, Source } from "../../types";
import { ListEditor, type FieldDef } from "./ListEditor";
import { OptionalSections } from "./OptionalSections";
import { SkillGroupsEditor } from "./SkillGroupsEditor";

type TextKey = "full_name" | "headline" | "email" | "phone" | "location" | "linkedin" | "website" | "summary";

const NOTICES: Partial<Record<Source, { title: string; text: string; warn?: boolean }>> = {
  linkedin: {
    title: "Identité importée depuis LinkedIn.",
    text: "LinkedIn ne partage que votre nom, votre e-mail et votre photo. Importez le PDF de votre profil ou ajoutez votre parcours ci-dessous.",
    warn: true,
  },
  "linkedin-pdf": { title: "Profil LinkedIn importé.", text: "Vérifiez les informations ci-dessous : tout est modifiable." },
  cv: { title: "Informations extraites de votre CV.", text: "Vérifiez-les et complétez ce qui manque : tout est modifiable." },
};

const EXPERIENCE_FIELDS: FieldDef<Experience>[] = [
  { key: "title", label: "Poste" },
  { key: "company", label: "Entreprise" },
  { key: "location", label: "Lieu" },
  { key: "start", label: "Début", placeholder: "ex. 02/2025" },
  { key: "end", label: "Fin", placeholder: "ex. 07/2025 ou Présent" },
  { key: "bullets", label: "Missions et réalisations (une par ligne)", textarea: true },
];
const EDUCATION_FIELDS: FieldDef<Education>[] = [
  { key: "degree", label: "Diplôme" },
  { key: "institution", label: "Établissement" },
  { key: "location", label: "Lieu" },
  { key: "start", label: "Début" },
  { key: "end", label: "Fin" },
  { key: "details", label: "Détails (mention, PFE, cours clés…) — une ligne par élément", textarea: true },
];
const PROJECT_FIELDS: FieldDef<Project>[] = [
  { key: "name", label: "Nom du projet" },
  { key: "link", label: "Lien (GitHub, démo…)", placeholder: "github.com/…" },
  { key: "technologies", label: "Technologies (séparées par des virgules)", wide: true },
  { key: "description", label: "Description (une ligne par point)", textarea: true },
];
const LANGUAGE_FIELDS: FieldDef<Language>[] = [
  { key: "language", label: "Langue" },
  { key: "level", label: "Niveau", placeholder: "ex. courant, B2, natif" },
];

export function ProfileView() {
  const { ws, update, updateProfile } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  const photoInput = useRef<HTMLInputElement>(null);
  const p = ws.profile as Profile;
  const { checks, pct } = completion(p);
  const notice = ws.source ? NOTICES[ws.source] : undefined;

  const bind = (k: TextKey) => ({
    value: p[k],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateProfile({ [k]: e.target.value }),
  });

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !f.type.startsWith("image/")) return;
    try {
      updateProfile({ photo: await readSquareImage(f) });
    } catch {
      toast("Impossible de lire cette image.");
    }
  };

  const reimport = () => {
    if (confirm("Réimporter remplacera les informations actuelles de votre profil. Continuer ?")) {
      update((w) => ({ ...w, profile: null, source: null, importFile: null, noticeClosed: false }));
    }
  };

  return (
    <section className="view">
      {notice && !ws.noticeClosed && (
        <div className={`notice${notice.warn || ws.importWarnings.length ? " warn" : ""}`}>
          <IconInfo />
          <div>
            <b>{notice.title}</b> {notice.text}
            {ws.importFile && <span className="muted"> ({ws.importFile})</span>}
            {ws.importMethod === "ocr" && (
              <div style={{ marginTop: 6 }}>Document scanné ou photo : lu par reconnaissance d'image, relisez attentivement.</div>
            )}
            {ws.importWarnings.length > 0 && (
              <ul className="notice-list">
                {ws.importWarnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            )}
          </div>
          <button className="icon-btn" aria-label="Fermer" onClick={() => update((w) => ({ ...w, noticeClosed: true }))}><IconX /></button>
        </div>
      )}

      <div className="profile-grid">
        <div className="stack">
          <div className="card">
            <div className="id-card">
              <button className="photo-up" aria-label="Changer la photo" onClick={() => photoInput.current?.click()}>
                {p.photo ? <img src={p.photo} alt="Photo de profil" /> : initials(p.full_name)}
                <span className="ov">Changer</span>
              </button>
              <div className="id-fields">
                <input className="name-input" placeholder="Prénom Nom" {...bind("full_name")} />
                <input className="headline-input" placeholder="Titre professionnel (ex. Développeuse web)" {...bind("headline")} />
                <div className="photo-actions">
                  <button className="link-btn" onClick={() => photoInput.current?.click()}>
                    {p.photo ? "Changer la photo" : "Ajouter une photo"}
                  </button>
                  {p.photo && (
                    <button className="link-btn" style={{ color: "var(--muted)" }} onClick={() => updateProfile({ photo: null })}>
                      Retirer la photo
                    </button>
                  )}
                </div>
              </div>
            </div>
            <input ref={photoInput} type="file" accept="image/*" hidden onChange={onPhoto} />
          </div>

          <div className="card">
            <div className="card-head"><h2>Coordonnées</h2></div>
            <div className="grid-2">
              <label className="field">E-mail<input type="email" placeholder="prenom.nom@email.com" {...bind("email")} /></label>
              <label className="field">Téléphone<input placeholder="+216 …" {...bind("phone")} /></label>
              <label className="field">Ville<input placeholder="Tunis" {...bind("location")} /></label>
              <label className="field">LinkedIn<input placeholder="linkedin.com/in/…" {...bind("linkedin")} /></label>
              <label className="field span-2">Portfolio / GitHub<input placeholder="github.com/…" {...bind("website")} /></label>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h2>À propos</h2><span className="muted small">2 à 4 phrases</span></div>
            <label className="field">
              <textarea placeholder="Qui êtes-vous, que savez-vous faire, que cherchez-vous ?" {...bind("summary")} />
            </label>
          </div>

          <ListEditor
            title="Expériences" addLabel="Ajouter une expérience" empty="Aucune expérience pour l'instant (stages, alternance, jobs…)."
            items={p.experiences} fields={EXPERIENCE_FIELDS}
            head={(x) => [x.title || "Nouvelle expérience", [x.company, dates(x)].filter(Boolean).join(" · ")]}
            blank={{ title: "", company: "", location: "", start: "", end: "", bullets: "" }}
            onChange={(experiences) => updateProfile({ experiences })}
          />
          <ListEditor
            title="Formation" addLabel="Ajouter une formation" empty="Ajoutez vos diplômes et formations."
            items={p.education} fields={EDUCATION_FIELDS}
            head={(x) => [x.degree || "Nouvelle formation", [x.institution, dates(x)].filter(Boolean).join(" · ")]}
            blank={{ degree: "", institution: "", location: "", start: "", end: "", details: "" }}
            onChange={(education) => updateProfile({ education })}
          />
          <ListEditor
            title="Projets" addLabel="Ajouter un projet" empty="Projets académiques ou personnels : très utiles pour un premier emploi."
            items={p.projects} fields={PROJECT_FIELDS}
            head={(x) => [x.name || "Nouveau projet", x.technologies]}
            blank={{ name: "", technologies: "", link: "", description: "" }}
            onChange={(projects) => updateProfile({ projects })}
          />

          <div className="card">
            <div className="card-head"><h2>Compétences</h2><span className="muted small">Regroupées par catégorie sur le CV</span></div>
            <SkillGroupsEditor groups={p.skills} onChange={(skills) => updateProfile({ skills })} />
          </div>

          <ListEditor
            title="Langues" addLabel="Ajouter une langue" empty="Ajoutez les langues que vous parlez."
            items={p.languages} fields={LANGUAGE_FIELDS}
            head={(x) => [x.language || "Nouvelle langue", x.level]}
            blank={{ language: "", level: "" }}
            onChange={(languages) => updateProfile({ languages })}
          />

          <OptionalSections profile={p} onChange={updateProfile} />
        </div>

        <aside className="profile-side stack">
          <div className="card complete">
            <svg className="ring" viewBox="0 0 120 120">
              <circle className="track" cx="60" cy="60" r="50" fill="none" strokeWidth="10" />
              <circle
                className="val" cx="60" cy="60" r="50" fill="none" strokeWidth="10"
                strokeDasharray="314.16" strokeDashoffset={314.16 * (1 - pct / 100)} transform="rotate(-90 60 60)"
              />
              <text x="60" y="70" textAnchor="middle">{pct}%</text>
            </svg>
            <b>Profil complété</b>
            <div className="todo">
              {checks.map(([label, ok]) => <div key={label} className={ok ? "ok" : ""}>{label}</div>)}
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => navigate("/app/template")}>Continuer : modèle de CV <IconArrow /></button>
          <button className="link-btn" style={{ justifySelf: "center", color: "var(--muted)" }} onClick={reimport}>
            Réimporter mon profil
          </button>
        </aside>
      </div>
    </section>
  );
}
