export type Lang = "fr" | "en";

export type Source = "linkedin" | "linkedin-pdf" | "cv" | "scratch";

export type Experience = { title: string; company: string; location: string; start: string; end: string; bullets: string };
export type Education = { degree: string; institution: string; location: string; start: string; end: string; details: string };
export type Project = { name: string; technologies: string; link: string; description: string };
export type Language = { language: string; level: string };
export type Hackathon = { name: string; result: string; date: string; description: string };
export type Association = { organization: string; role: string; start: string; end: string; description: string };
/** Optional CV sections: only shown when switched on (and filled) */
export type OptionalSections = { hackathons: boolean; associations: boolean; interests: boolean };
/** Skills shown on the CV as "Category: a, b, c" (an empty category shows the items alone). */
export type SkillGroup = { category: string; items: string[] };

export type Profile = {
  photo: string | null;
  full_name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
  summary: string;
  experiences: Experience[];
  education: Education[];
  projects: Project[];
  skills: SkillGroup[];
  languages: Language[];
  hackathons: Hackathon[];
  associations: Association[];
  interests: string[];
  sections: OptionalSections;
};

/** Structured job offer, as returned by the backend's analysis. */
export type JobAnalysis = {
  job_title: string;
  company: string;
  location: string;
  language: Lang;
  seniority: "internship" | "junior" | "mid" | "senior" | "lead" | "";
  contract_type: string;
  salary: string;
  education: string;
  experience: string;
  spoken_languages: string[];
  summary: string;
  required_skills: string[];
  nice_to_have_skills: string[];
  soft_skills: string[];
  responsibilities: string[];
  keywords: string[];
};

export type KeywordCoverage = { percent: number; found: string[]; missing: string[] };

export type TailorResult = {
  profile: Profile;
  changes: string[];
  warnings: string[];
  coverage_before: KeywordCoverage;
  coverage_after: KeywordCoverage;
};

export type CoverLetter = { subject: string; greeting: string; paragraphs: string[]; closing: string };
export type LetterResult = { letter: CoverLetter; warnings: string[] };

/** What the candidate wants to produce */
export type GenMode = "cv" | "both" | "letter";

/** Everything produced for the current offer; regenerated when the offer or the language changes. */
export type Generation = {
  mode: GenMode;
  lang: Lang;
  notes: string;
  /** Offer text the analysis below was computed for */
  offerText: string;
  job: JobAnalysis | null;
  cv: TailorResult | null;
  letter: LetterResult | null;
  /** The letter as edited by the candidate */
  letterText: string;
};

export type TemplateId = "classic" | "modern" | "compact" | "elegant" | "latex";
export type Settings = { template: TemplateId; photo: boolean; accent: string };

export type Workspace = {
  profile: Profile | null;
  source: Source | null;
  importFile: string | null;
  importMethod: "text" | "ocr" | null;
  importWarnings: string[];
  noticeClosed: boolean;
  offer: { text: string };
  settings: Settings;
  generation: Generation;
};

export const emptyGeneration = (): Generation => ({
  mode: "both", lang: "fr", notes: "", offerText: "", job: null, cv: null, letter: null, letterText: "",
});

export const emptyProfile = (): Profile => ({
  photo: null, full_name: "", headline: "", email: "", phone: "", location: "", linkedin: "", website: "", summary: "",
  experiences: [], education: [], projects: [], skills: [], languages: [],
  hackathons: [], associations: [], interests: [],
  sections: { hackathons: false, associations: false, interests: false },
});

export const allSkills = (p: Profile) => p.skills.flatMap((g) => g.items);

/** Brings profiles saved by older versions up to date (flat skills list, projects without link). */
export function migrateProfile(p: Profile): Profile {
  const skills = p.skills as unknown[];
  return {
    ...emptyProfile(),
    ...p,
    sections: { ...emptyProfile().sections, ...p.sections },
    skills: skills.length && typeof skills[0] === "string" ? [{ category: "", items: skills as string[] }] : p.skills,
    projects: p.projects.map((x) => ({ ...x, link: x.link ?? "", technologies: x.technologies ?? "" })),
  };
}
