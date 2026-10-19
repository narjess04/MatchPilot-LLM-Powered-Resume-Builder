import { useState } from "react";
import { IconX } from "../../components/icons";
import type { SkillGroup } from "../../types";
import { SkillsInput } from "./SkillsInput";

/** Common CV categories offered as one-click groups */
export const SKILL_CATEGORIES = [
  "Langages de programmation",
  "Frameworks & bibliothèques",
  "Bases de données",
  "Outils & DevOps",
  "IA & Data",
  "Cloud",
  "Méthodes",
  "Bureautique",
  "Soft skills",
];

type Props = { groups: SkillGroup[]; onChange: (groups: SkillGroup[]) => void };

export function SkillGroupsEditor({ groups, onChange }: Props) {
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const used = new Set(groups.map((g) => g.category.toLowerCase()));
  const suggestions = SKILL_CATEGORIES.filter((c) => !used.has(c.toLowerCase()));

  const set = (i: number, patch: Partial<SkillGroup>) => onChange(groups.map((g, k) => (k === i ? { ...g, ...patch } : g)));
  const add = (category: string) => {
    setFocusIndex(groups.length);
    onChange([...groups, { category, items: [] }]);
  };

  return (
    <div className="skill-groups">
      {groups.length === 0 && (
        <p className="empty">Choisissez une catégorie ci-dessous, puis collez ou tapez vos compétences : la liste est découpée automatiquement.</p>
      )}

      {groups.map((g, i) => (
        <div key={i} className="skill-group">
          <div className="skill-group-head">
            <input
              className="skill-cat"
              value={g.category}
              placeholder="Sans catégorie"
              aria-label="Nom de la catégorie"
              onChange={(e) => set(i, { category: e.target.value })}
            />
            <span className="muted small">{g.items.length || ""}</span>
            <button type="button" className="icon-btn" aria-label="Supprimer la catégorie" onClick={() => onChange(groups.filter((_, k) => k !== i))}>
              <IconX />
            </button>
          </div>
          <SkillsInput
            skills={g.items}
            onChange={(items) => set(i, { items })}
            placeholder="Collez une liste (ex. Python, SQL, Java) ou tapez puis Entrée"
            autoFocus={focusIndex === i}
          />
        </div>
      ))}

      <div className="cat-suggest">
        <span className="muted small">Ajouter une catégorie :</span>
        {suggestions.map((c) => (
          <button key={c} type="button" className="cat-chip" onClick={() => add(c)}>+ {c}</button>
        ))}
        <button type="button" className="cat-chip custom" onClick={() => add("")}>+ Personnalisée</button>
      </div>
    </div>
  );
}
