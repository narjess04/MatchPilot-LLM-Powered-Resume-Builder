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

export type SkillMatch = {
  skill: string;
  importance: "required" | "nice_to_have";
  status: "match" | "partial" | "missing";
  /** Excerpt of the profile that proves it */
  evidence: string;
};
export type CriterionMatch = {
  criterion: "education" | "experience" | "spoken_languages";
  asked: string;
  status: "met" | "partial" | "unmet" | "unknown";
  note: string;
};
/** Fit between the profile and the offer, judged by meaning whatever their languages. */
export type MatchReport = {
  score: number;
  skills_score: number;
  criteria_score: number | null;
  verdict: string;
  skills: SkillMatch[];
  criteria: CriterionMatch[];
  strengths: string[];
  tips: string[];
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
  match: MatchReport | null;
  /** Profile + offer the match above was computed for (see matchKey) */
  matchFor: string;
};

export type TemplateId = "classic" | "modern" | "compact" | "elegant" | "latex" | "custom";

/** Look of the candidate's example CV, as read by the vision model (the "custom" template). */
export type CvStyle = {
  font: "sans" | "serif";
  header_align: "left" | "center";
  name_size: "small" | "medium" | "large";
  name_uppercase: boolean;
  accent: string;
  name_in_accent: boolean;
  headings_in_accent: boolean;
  heading_style: "underline" | "bar" | "filled" | "plain";
  heading_uppercase: boolean;
  density: "airy" | "normal" | "compact";
  photo: "none" | "round" | "square";
  two_columns: boolean;
  description: string;
};
export type ExampleStyle = { style: CvStyle; preview: string; notes: string[] };
export type CustomTemplate = ExampleStyle & { fileName: string };

export type Settings = {
  template: TemplateId;
  photo: boolean;
  accent: string;
  /** Template built from the candidate's example CV, if any */
  custom?: CustomTemplate | null;
};

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
  match: null, matchFor: "",
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
