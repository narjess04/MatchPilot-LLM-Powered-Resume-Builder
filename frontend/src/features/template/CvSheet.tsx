import { forwardRef, Fragment, useCallback, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { CV_LABELS } from "../../lib/cvLabels";
import { shortUrl, withScheme } from "../../lib/latex";
import { dates, inlineDescription, lines } from "../../lib/utils";
import { allSkills, type Lang, type Profile, type Settings } from "../../types";
import { TEMPLATES, templateOf } from "./templates";

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

export const A4_WIDTH = 794;
export const A4_HEIGHT = 1123;
const MIN_FIT = 0.78; // below this the text gets too small to read: the CV must be shortened instead

type Props = {
  profile: Profile;
  settings: Settings;
  lang?: Lang;
  /** Shrink the page (down to MIN_FIT) so the CV fits on one A4 page; reports the scale and whether it fits */
  onePage?: boolean;
  onFit?: (fit: { scale: number; fits: boolean }) => void;
};

/** A4 CV page rendered with the selected template (single column, ATS-friendly). */
export const CvSheet = forwardRef<HTMLDivElement, Props>(function CvSheet(
  { profile: p, settings: s, lang = "fr", onePage = false, onFit },
  ref,
) {
  const LABELS = CV_LABELS[lang];
  const template = templateOf(s);
  const custom = template === "custom" ? s.custom!.style : null;
  const showPhoto = s.photo && TEMPLATES[template].photo && !!p.photo;
  const contact: ReactNode[] = [
    p.email && <a href={`mailto:${p.email}`}>{p.email}</a>,
    p.phone,
    p.location,
    p.linkedin && <a href={withScheme(p.linkedin)}>{shortUrl(p.linkedin)}</a>,
    p.website && <a href={withScheme(p.website)}>{shortUrl(p.website)}</a>,
  ].filter(Boolean);

  const sheet = useRef<HTMLDivElement | null>(null);
  const setRefs = useCallback((el: HTMLDivElement | null) => {
    sheet.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  }, [ref]);

  // One page: lay the content out on a wider page and scale it down until it fits the A4 height.
  // The text stays real text (in the PDF too); `data-fit` tells the parent the visual scale.
  useLayoutEffect(() => {
    const el = sheet.current;
    if (!el) return;
    Object.assign(el.style, { width: "", minHeight: "", transform: "" });
    el.dataset.fit = "1";
    if (!onePage) return;
    el.style.minHeight = "0px";
    let scale = 1;
    while (el.offsetHeight * scale > A4_HEIGHT && scale > MIN_FIT) {
      scale = Math.max(MIN_FIT, +(scale - 0.02).toFixed(2));
      el.style.width = `${A4_WIDTH / scale}px`;
    }
    const fits = el.offsetHeight * scale <= A4_HEIGHT;
    Object.assign(el.style, {
      minHeight: `${A4_HEIGHT / scale}px`,
      transform: scale < 1 ? `scale(${scale})` : "",
      transformOrigin: "top left",
    });
    el.dataset.fit = String(scale);
    onFit?.({ scale, fits });
  });

  return (
    <div
      ref={setRefs}
      className={`sheet tpl-${template}`}
      style={{ "--acc": s.accent } as CSSProperties}
      {...(custom && {
        "data-font": custom.font,
        "data-align": custom.header_align,
        "data-name": custom.name_size,
        "data-heading": custom.heading_style,
        "data-density": custom.density,
        "data-photo": custom.photo === "round" ? "round" : "square",
        "data-name-upper": custom.name_uppercase || undefined,
        "data-name-acc": custom.name_in_accent || undefined,
        "data-head-upper": custom.heading_uppercase || undefined,
        "data-head-acc": custom.headings_in_accent || undefined,
      })}
    >
      <header className="cv-head">
        {showPhoto && <img className="cv-photo" src={p.photo!} alt="" />}
        <div className="who">
          <h1>{p.full_name || "Prénom Nom"}</h1>
          {p.headline && <div className="cv-title">{p.headline}</div>}
          {contact.length > 0 && (
            <div className="cv-contact">{contact.map((c, i) => <Fragment key={i}>{i > 0 && " · "}{c}</Fragment>)}</div>
          )}
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

      {/* Education is compact (one line per degree) so the page goes to experience and projects */}
      <Section title={LABELS.education} show={p.education.length > 0}>
        {p.education.map((x, i) => (
          <div key={i} className="cv-entry cv-compact">
            <div className="cv-row">
              <div className="cv-line">
                <b>{x.degree}</b>
                {(x.institution || x.location) && ` — ${[x.institution, x.location].filter(Boolean).join(", ")}`}
              </div>
              <span>{dates(x)}</span>
            </div>
            {lines(x.details).length > 0 && <div className="cv-org">{lines(x.details).join(" · ")}</div>}
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

      {/* Hackathons last, one line each: name — result : the project, date on the right */}
      <Section title={LABELS.hackathons} show={shown(p, "hackathons")}>
        {p.hackathons.map((x, i) => {
          const project = inlineDescription(x.description);
          return (
            <div key={i} className="cv-entry cv-compact">
              <div className="cv-row">
                <div className="cv-line">
                  <b>{x.name}</b>
                  {x.result && ` — ${x.result}`}
                  {project && `${LABELS.colon}${project}`}
                </div>
                <span>{x.date}</span>
              </div>
            </div>
          );
        })}
      </Section>
    </div>
  );
});
