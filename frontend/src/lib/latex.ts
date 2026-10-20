import type { Lang, Profile } from "../types";
import { CV_LABELS } from "./cvLabels";
import { dates, lines } from "./utils";

/** Escapes text for LaTeX (pdfLaTeX, UTF-8 input). */
export function tex(s: string): string {
  return s
    .replace(/\\/g, "\u0000")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/\u0000/g, "\\textbackslash{}")
    .replace(/[‐‑­]/g, "-")
    .replace(/ /g, "~");
}

export const withScheme = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);
/** Display form of a URL: no scheme, no "www.", no trailing slash. */
export const shortUrl = (url: string) => url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
const href = (url: string) =>
  `\\href{${withScheme(url).replace(/([%#])/g, "\\$1")}}{${tex(shortUrl(url))}}`;

const itemize = (txt: string) => {
  const items = lines(txt);
  return items.length ? `\\begin{itemize}\n${items.map((l) => `  \\item ${tex(l)}`).join("\n")}\n\\end{itemize}\n` : "";
};

/** Full, compilable .tex document for the profile (pdfLaTeX, e.g. on Overleaf). */
export function toLatex(p: Profile, accent = "#0f6e63", lang: Lang = "fr"): string {
  const L = CV_LABELS[lang];
  const colon = L.colon.replace(" ", "~"); // non-breaking space before the French colon
  const contact = [
    p.email && `\\href{mailto:${p.email}}{${tex(p.email)}}`,
    p.phone && tex(p.phone),
    p.location && tex(p.location),
    p.linkedin && href(p.linkedin),
    p.website && href(p.website),
  ].filter(Boolean).join(" \\enspace$\\cdot$\\enspace ");

  const section = (title: string, body: string) => (body.trim() ? `\\section{${title}}\n${body}\n` : "");

  const experiences = p.experiences.map((x) =>
    `\\entry{${tex(x.title)}}{${tex(dates(x))}}{${tex(x.company)}}{${tex(x.location)}}\n${itemize(x.bullets)}`).join("\n");

  const projects = p.projects.map((x) =>
    `\\project{${tex(x.name)}}{${x.link ? href(x.link) : ""}}\n${itemize(x.description)}`).join("\n");

  const education = p.education.map((x) =>
    `\\entry{${tex(x.degree)}}{${tex(dates(x))}}{${tex(x.institution)}}{${tex(x.location)}}\n${itemize(x.details)}`).join("\n");

  const skills = p.skills
    .filter((g) => g.items.length)
    .map((g) => (g.category ? `\\textbf{${tex(g.category)}${colon}}` : "") + g.items.map(tex).join(", "))
    // Languages are a line of the skills section
    .concat(p.languages.length
      ? [`\\textbf{${L.languages}${colon}}${p.languages.map((l) => tex(l.level ? `${l.language} (${l.level})` : l.language)).join(", ")}`]
      : [])
    .join("\\\\\n");

  const on = (k: keyof Profile["sections"]) => p.sections[k] && p[k].length > 0;
  // Single-line heading when there is no second line (organisation / result) to show
  const heading = (title: string, right: string, sub: string) =>
    sub ? `\\entry{${tex(title)}}{${tex(right)}}{${tex(sub)}}{}` : `\\project{${tex(title)}}{\\textit{${tex(right)}}}`;
  // One line each: name — result (date on the right), no description
  const hackathons = on("hackathons")
    ? p.hackathons.map((x) =>
        `\\textbf{${tex(x.name)}}${x.result ? ` — ${tex(x.result)}` : ""}\\hfill\\textit{${tex(x.date)}}\\par`).join("\n\\smallskip\n")
    : "";
  const associations = on("associations")
    ? p.associations.map((x) =>
        `${heading([x.role, x.organization].filter(Boolean).join(" — "), dates(x), "")}\n${itemize(x.description)}`).join("\n")
    : "";
  const interests = on("interests") ? p.interests.map(tex).join(" \\enspace$\\cdot$\\enspace ") : "";

  return `% CV généré par MatchPilot — compilez avec pdfLaTeX (ex. sur Overleaf)
\\documentclass[a4paper,10pt]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage[default]{lato}
\\usepackage[margin=1.6cm]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{xcolor}
\\usepackage[hidelinks]{hyperref}

\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\definecolor{accent}{HTML}{${accent.replace("#", "").toUpperCase()}}
\\titleformat{\\section}{\\normalsize\\bfseries\\color{accent}}{}{0pt}{\\MakeUppercase}[\\vspace{-0.6ex}{\\color{accent}\\titlerule}]
\\titlespacing*{\\section}{0pt}{1.4ex}{0.9ex}
\\setlist[itemize]{leftmargin=1.3em, itemsep=1pt, topsep=2pt, parsep=0pt}

% \\entry{titre}{dates}{organisation}{lieu}
\\newcommand{\\entry}[4]{\\textbf{#1}\\hfill\\textit{#2}\\\\\\textit{#3}\\hfill\\textit{#4}\\par}
% \\project{nom}{lien}
\\newcommand{\\project}[2]{\\textbf{#1}\\hfill{\\small #2}\\par}

\\begin{document}

\\begin{center}
  {\\huge\\bfseries ${tex(p.full_name || "Prénom Nom")}}\\\\[3pt]
${p.headline ? `  ${tex(p.headline)}\\\\[3pt]\n` : ""}  {\\small ${contact}}
\\end{center}

${section(L.summary, p.summary ? tex(p.summary) : "")}${section(L.experience, experiences)}${section(L.projects, projects)}${section(L.education, education)}${section(L.skills, skills)}${section(tex(L.associations), associations)}${section(tex(L.interests), interests)}${section(tex(L.hackathons), hackathons)}
\\end{document}
`;
}
