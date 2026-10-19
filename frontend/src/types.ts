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
};

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
