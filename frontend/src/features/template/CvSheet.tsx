import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { CV_LABELS } from "../../lib/cvLabels";
import { shortUrl } from "../../lib/latex";
import { dates, lines } from "../../lib/utils";
import { allSkills, type Lang, type Profile, type Settings } from "../../types";
import { TEMPLATES } from "./templates";

export const languagesLine = (p: Profile) =>
  p.languages.map((l) => (l.level ? `${l.language} (${l.level})` : l.language)).join(", ");

/** Optional sections appear only when switched on and filled */
export const shown = (p: Profile, key: keyof Profile["sections"]) => p.sections[key] && p[key].length > 0;

const Bullets = ({ text }: { text: string }) => {
  const items = lines(text);
  return items.length ? <ul>{items.map((l, i) => <li key={i}>{l}</li>)}</ul> : null;
};

const Section = ({ title, show, children }: { title: string; show: boolean; children: ReactNode }) =>
  show ? <section><h2>{title}</h2>{children}</section> : null;

type Props = { profile: Profile; settings: Settings; lang?: Lang };

/** A4 CV page rendered with the selected template (single column, ATS-friendly). */
export const CvSheet = forwardRef<HTMLDivElement, Props>(function CvSheet({ profile: p, settings: s, lang = "fr" }, ref) {
  const LABELS = CV_LABELS[lang];
  const showPhoto = s.photo && TEMPLATES[s.template].photo && !!p.photo;
  const contact = [p.email, p.phone, p.location, p.linkedin, p.website].filter(Boolean).join(" · ");

  return (
    <div ref={ref} className={`sheet tpl-${s.template}`} style={{ "--acc": s.accent } as CSSProperties}>
      <header className="cv-head">
        {showPhoto && <img className="cv-photo" src={p.photo!} alt="" />}
        <div className="who">
          <h1>{p.full_name || "Prénom Nom"}</h1>
          {p.headline && <div className="cv-title">{p.headline}</div>}
          {contact && <div className="cv-contact">{contact}</div>}
        </div>
      </header>

      <Section title={LABELS.summary} show={!!p.summary}><p>{p.summary}</p></Section>

      <Section title={LABELS.experience} show={p.experiences.length > 0}>
        {p.experiences.map((x, i) => (
          <div key={i} className="cv-entry">
            <div className="cv-row"><b>{x.title}</b><span>{dates(x)}</span></div>
            <div className="cv-org">{[x.company, x.location].filter(Boolean).join(", ")}</div>
            <Bullets text={x.bullets} />
          </div>
        ))}
      </Section>

      <Section title={LABELS.projects} show={p.projects.length > 0}>
        {p.projects.map((x, i) => (
          <div key={i} className="cv-entry">
            <div className="cv-row">
              <b>{x.name}</b>
              {x.link && (
                <a className="cv-link" href={/^https?:\/\//i.test(x.link) ? x.link : `https://${x.link}`} target="_blank" rel="noreferrer">
                  {shortUrl(x.link)}
                </a>
              )}
            </div>
            <Bullets text={x.description} />
          </div>
        ))}
      </Section>

      <Section title={LABELS.education} show={p.education.length > 0}>
        {p.education.map((x, i) => (
          <div key={i} className="cv-entry">
            <div className="cv-row"><b>{x.degree}</b><span>{dates(x)}</span></div>
            <div className="cv-org">{[x.institution, x.location].filter(Boolean).join(", ")}</div>
            <Bullets text={x.details} />
          </div>
        ))}
      </Section>

      {/* Languages are listed inside the skills section */}
      <Section title={LABELS.skills} show={allSkills(p).length > 0 || p.languages.length > 0}>
        {p.skills.filter((g) => g.items.length).map((g, i) => (
          <p key={i} className="cv-skills">
            {g.category && <b>{g.category}{LABELS.colon}</b>}
            {g.items.join(g.category ? ", " : " · ")}
          </p>
        ))}
        {p.languages.length > 0 && (
          <p className="cv-skills"><b>{LABELS.languages}{LABELS.colon}</b>{languagesLine(p)}</p>
        )}
      </Section>

      <Section title={LABELS.associations} show={shown(p, "associations")}>
        {p.associations.map((x, i) => (
          <div key={i} className="cv-entry">
            <div className="cv-row"><b>{[x.role, x.organization].filter(Boolean).join(" — ")}</b><span>{dates(x)}</span></div>
            <Bullets text={x.description} />
          </div>
        ))}
      </Section>

      <Section title={LABELS.interests} show={shown(p, "interests")}>
        <p>{p.interests.join(" · ")}</p>
      </Section>

      {/* Hackathons last, one line each: name — result, date on the right (no description) */}
      <Section title={LABELS.hackathons} show={shown(p, "hackathons")}>
        {p.hackathons.map((x, i) => (
          <div key={i} className="cv-entry cv-compact">
            <div className="cv-row">
              <div className="cv-line">
                <b>{x.name}</b>
                {x.result && ` — ${x.result}`}
              </div>
              <span>{x.date}</span>
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
});
