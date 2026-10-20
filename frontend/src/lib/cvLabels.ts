import type { Lang } from "../types";

/** Section headings of the CV, in the language the CV is written in. */
export const CV_LABELS = {
  fr: {
    summary: "Profil",
    experience: "Expérience professionnelle",
    projects: "Projets",
    education: "Formation",
    skills: "Compétences",
    languages: "Langues",
    hackathons: "Hackathons & compétitions",
    associations: "Vie associative",
    interests: "Centres d'intérêt",
    colon: " : ", // French typography: space before the colon
  },
  en: {
    summary: "Profile",
    experience: "Professional experience",
    projects: "Projects",
    education: "Education",
    skills: "Skills",
    languages: "Languages",
    hackathons: "Hackathons & competitions",
    associations: "Volunteering & associations",
    interests: "Interests",
    colon: ": ",
  },
} satisfies Record<Lang, Record<string, string>>;
