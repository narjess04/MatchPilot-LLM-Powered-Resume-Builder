"""Deterministic NLP checks that don't need the LLM.

- keyword_coverage: how many ATS keywords of the offer literally appear in a CV
- faithfulness_warnings: flags content in a tailored CV that is absent from the original
"""

import re
import unicodedata

from .schemas import CVData, ExtractedProfile, JobAnalysis, KeywordCoverage


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", text.lower()).strip()


def contains_term(haystack: str, term: str) -> bool:
    """Whole-word match on normalized text; works for terms like 'C++', 'Node.js', 'CI/CD'."""
    needle = normalize(term)
    if not needle:
        return False
    pattern = r"(?<![\w])" + re.escape(needle) + r"(?![\w])"
    return re.search(pattern, haystack) is not None


def cv_to_text(cv: CVData) -> str:
    parts: list[str] = [cv.full_name, cv.headline or "", cv.summary or ""]
    for e in cv.experiences:
        parts += [e.title, e.company, *e.bullets]
    for ed in cv.education:
        parts += [ed.degree, ed.institution, *ed.details]
    for g in cv.skills:
        parts += [g.category, *g.items]
    for p in cv.projects:
        parts += [p.name, p.description or "", *p.technologies, *p.bullets]
    parts += [c.name for c in cv.certifications]
    parts += [lang.language for lang in cv.languages]
    return "\n".join(x for x in parts if x)


def job_keywords(job: JobAnalysis) -> list[str]:
    seen: dict[str, str] = {}
    for term in [*job.keywords, *job.required_skills]:
        key = normalize(term)
        if key and key not in seen:
            seen[key] = term.strip()
    return list(seen.values())


def keyword_coverage(text: str, job: JobAnalysis) -> KeywordCoverage:
    haystack = normalize(text)
    keywords = job_keywords(job)
    found = [k for k in keywords if contains_term(haystack, k)]
    missing = [k for k in keywords if k not in found]
    percent = round(100 * len(found) / len(keywords)) if keywords else 0
    return KeywordCoverage(percent=percent, found=found, missing=missing)


def faithfulness_warnings(original: CVData, original_text: str, tailored: CVData, lang: str) -> list[str]:
    """Return human-readable warnings for anything that looks invented."""
    fr = lang == "fr"
    source = normalize(original_text + "\n" + cv_to_text(original))
    warnings: list[str] = []

    orig_companies = {normalize(e.company) for e in original.experiences}
    for e in tailored.experiences:
        if normalize(e.company) not in orig_companies and not contains_term(source, e.company):
            warnings.append(
                f"Expérience ajoutée absente du CV original : {e.title} — {e.company}"
                if fr
                else f"Experience not found in the original CV: {e.title} — {e.company}"
            )

    orig_schools = {normalize(ed.institution) for ed in original.education}
    for ed in tailored.education:
        if normalize(ed.institution) not in orig_schools and not contains_term(source, ed.institution):
            warnings.append(
                f"Formation absente du CV original : {ed.degree} — {ed.institution}"
                if fr
                else f"Education not found in the original CV: {ed.degree} — {ed.institution}"
            )

    orig_certs = {normalize(c.name) for c in original.certifications}
    for c in tailored.certifications:
        if normalize(c.name) not in orig_certs and not contains_term(source, c.name):
            warnings.append(
                f"Certification absente du CV original : {c.name}"
                if fr
                else f"Certification not found in the original CV: {c.name}"
            )

    new_skills = [s for g in tailored.skills for s in g.items if not contains_term(source, s)]
    if new_skills:
        joined = ", ".join(new_skills)
        warnings.append(
            f"Compétences non trouvées mot pour mot dans le CV original (à vérifier) : {joined}"
            if fr
            else f"Skills not found verbatim in the original CV (please check): {joined}"
        )
    return warnings


# ---------- Profile import ----------


def _loose(text: str) -> str:
    """Normalized text where punctuation is ignored: 'Node.js – React' -> 'node js react'."""
    return re.sub(r"[^a-z0-9@+#]+", " ", normalize(text)).strip()


def _found(needle: str, haystack_loose: str) -> bool:
    n = _loose(needle)
    return not n or f" {n} " in f" {haystack_loose} "


def profile_warnings(p: ExtractedProfile, source_text: str) -> list[str]:
    """Flags extracted items that don't appear in the source document (possible model invention)."""
    hay = _loose(source_text)
    warnings: list[str] = []

    for label, value in (("Nom", p.full_name), ("E-mail", p.email)):
        if value and not _found(value, hay):
            warnings.append(f"{label} introuvable tel quel dans le document : « {value} ».")
    digits = re.sub(r"\D", "", p.phone)
    if digits and digits not in re.sub(r"\D", "", source_text):
        warnings.append(f"Téléphone introuvable tel quel dans le document : « {p.phone} ».")

    for x in p.experiences:
        for value in (x.company, x.title):
            if value and not _found(value, hay):
                warnings.append(f"Expérience à vérifier : « {x.title} — {x.company} ».")
                break
    for x in p.education:
        for value in (x.institution, x.degree):
            if value and not _found(value, hay):
                warnings.append(f"Formation à vérifier : « {x.degree} — {x.institution} ».")
                break

    for x in p.associations:
        if x.organization and not _found(x.organization, hay):
            warnings.append(f"Vie associative à vérifier : « {x.organization} ».")
    for x in p.hackathons:
        if x.name and not _found(x.name, hay):
            warnings.append(f"Hackathon à vérifier : « {x.name} ».")

    missing_skills = [s for g in p.skills for s in g.items if not _found(s, hay)]
    if missing_skills:
        warnings.append("Compétences introuvables telles quelles dans le document : " + ", ".join(missing_skills) + ".")
    return warnings
