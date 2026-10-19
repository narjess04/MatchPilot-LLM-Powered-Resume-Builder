import type { Association, Hackathon, OptionalSections as Sections, Profile } from "../../types";
import { dates } from "../../lib/utils";
import { ListEditor, type FieldDef } from "./ListEditor";
import { SkillsInput } from "./SkillsInput";

const HACKATHON_FIELDS: FieldDef<Hackathon>[] = [
  { key: "name", label: "Nom du hackathon / de la compétition" },
  { key: "date", label: "Date", placeholder: "ex. 2024" },
  { key: "result", label: "Résultat ou rôle", placeholder: "ex. 1re place, finaliste, chef d'équipe", wide: true },
  { key: "description", label: "Ce que vous avez réalisé (une ligne par point)", textarea: true },
];
const ASSOCIATION_FIELDS: FieldDef<Association>[] = [
  { key: "organization", label: "Club / association" },
  { key: "role", label: "Rôle", placeholder: "ex. Membre, trésorière, responsable…" },
  { key: "start", label: "Début" },
  { key: "end", label: "Fin", placeholder: "ex. 2025 ou Présent" },
  { key: "description", label: "Actions menées (une ligne par point)", textarea: true },
];

const LABELS: Record<keyof Sections, string> = {
  hackathons: "Hackathons & compétitions",
  associations: "Vie associative",
  interests: "Centres d'intérêt",
};

type Props = { profile: Profile; onChange: (patch: Partial<Profile>) => void };

/** Sections a CV only shows when the candidate has something to put in them. */
export function OptionalSections({ profile: p, onChange }: Props) {
  const toggle = (key: keyof Sections, on: boolean) => onChange({ sections: { ...p.sections, [key]: on } });
  const remove = (key: keyof Sections) => (
    <button type="button" className="link-btn" style={{ color: "var(--muted)" }} onClick={() => toggle(key, false)}>
      Retirer du CV
    </button>
  );
  const inactive = (Object.keys(LABELS) as (keyof Sections)[]).filter((k) => !p.sections[k]);

  return (
    <>
      {p.sections.hackathons && (
        <ListEditor
          title={LABELS.hackathons} addLabel="Ajouter un hackathon" empty="Hackathons, concours, challenges…"
          items={p.hackathons} fields={HACKATHON_FIELDS} action={remove("hackathons")}
          head={(x) => [x.name || "Nouveau hackathon", [x.result, x.date].filter(Boolean).join(" · ")]}
          blank={{ name: "", result: "", date: "", description: "" }}
          onChange={(hackathons) => onChange({ hackathons })}
        />
      )}
      {p.sections.associations && (
        <ListEditor
          title={LABELS.associations} addLabel="Ajouter un club ou une association" empty="Clubs étudiants, associations, bénévolat…"
          items={p.associations} fields={ASSOCIATION_FIELDS} action={remove("associations")}
          head={(x) => [x.organization || "Nouvelle association", [x.role, dates(x)].filter(Boolean).join(" · ")]}
          blank={{ organization: "", role: "", start: "", end: "", description: "" }}
          onChange={(associations) => onChange({ associations })}
        />
      )}
      {p.sections.interests && (
        <div className="card">
          <div className="card-head"><h2>{LABELS.interests}</h2>{remove("interests")}</div>
          <SkillsInput skills={p.interests} onChange={(interests) => onChange({ interests })} placeholder="Ex. randonnée, photographie, échecs…" />
        </div>
      )}

      {inactive.length > 0 && (
        <div className="card optional-card">
          <div>
            <h2>Sections optionnelles</h2>
            <p className="muted small">À ajouter seulement si vous avez quelque chose à y mettre.</p>
          </div>
          <div className="cat-suggest">
            {inactive.map((k) => (
              <button key={k} type="button" className="cat-chip" onClick={() => toggle(k, true)}>+ {LABELS[k]}</button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
