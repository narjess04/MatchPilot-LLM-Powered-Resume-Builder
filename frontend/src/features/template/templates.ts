import type { Settings, TemplateId } from "../../types";

export const TEMPLATES: Record<TemplateId, { name: string; desc: string; photo: boolean }> = {
  classic: { name: "Classique", desc: "Sobre et universel, le plus sûr pour les ATS.", photo: false },
  modern: { name: "Moderne", desc: "Une touche de couleur, photo possible.", photo: true },
  compact: { name: "Compact", desc: "Dense, idéal pour tenir sur une page.", photo: false },
  elegant: { name: "Élégant", desc: "Typographie serif, photo possible.", photo: true },
  latex: { name: "LaTeX", desc: "Style académique, exportable en .tex pour Overleaf.", photo: false },
  custom: { name: "Mon modèle", desc: "Le style de votre CV exemple.", photo: true },
};

/** Ready-made templates (the custom one is shown apart, once an example has been sent) */
export const BUILT_IN = (Object.keys(TEMPLATES) as TemplateId[]).filter((id) => id !== "custom");

/** Template actually used: "custom" falls back to Moderne when its example was removed. */
export const templateOf = (s: Settings): TemplateId => (s.template === "custom" && !s.custom ? "modern" : s.template);

export const ACCENTS = ["#0f6e63", "#1f3a68", "#8a1c2b", "#3b3b3b"];
