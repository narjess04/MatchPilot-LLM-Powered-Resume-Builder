"""Data models shared by the API and the LLM agents.

The models used as LLM output formats (ExtractedProfile, JobAnalysis, TailorDraft,
CoverLetter) are sent to the models as JSON schemas, so field
descriptions double as instructions.
"""

from typing import Literal

from pydantic import BaseModel, Field

Lang = Literal["fr", "en"]


# ---------- Candidate CV ----------


class Link(BaseModel):
    label: str = Field(description="e.g. LinkedIn, GitHub, Portfolio")
    url: str


class Contact(BaseModel):
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    links: list[Link] = []


class Experience(BaseModel):
    title: str
    company: str
    location: str | None = None
    start_date: str | None = Field(default=None, description="As written in the CV, e.g. '09/2022' or 'Sept. 2022'")
    end_date: str | None = Field(default=None, description="As written, or 'Present'/'Présent' if ongoing")
    bullets: list[str] = []


class Education(BaseModel):
    degree: str
    institution: str
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    details: list[str] = []


class SkillGroup(BaseModel):
    category: str = Field(description="e.g. Languages, Frameworks, Tools, Soft skills")
    items: list[str]


class Project(BaseModel):
    name: str
    description: str | None = None
    technologies: list[str] = []
    bullets: list[str] = []
    link: str | None = None


class Certification(BaseModel):
    name: str
    issuer: str | None = None
    date: str | None = None


class LanguageSkill(BaseModel):
    language: str
    level: str | None = None


class CVData(BaseModel):
    full_name: str
    headline: str | None = Field(default=None, description="Short professional title under the name")
    contact: Contact
    summary: str | None = None
    experiences: list[Experience] = []
    education: list[Education] = []
    skills: list[SkillGroup] = []
    projects: list[Project] = []
    certifications: list[Certification] = []
    languages: list[LanguageSkill] = []
    interests: list[str] = []


# ---------- Profile import (LLM extraction schema) ----------
# Every field is required: the model writes "" or [] when the CV has no such information.


class ExtractedExperience(BaseModel):
    title: str = Field(description="Job title exactly as written")
    company: str
    location: str
    start: str = Field(description="Start date exactly as written, e.g. '02/2025' or 'Sept. 2022'")
    end: str = Field(description="End date as written, or the CV's word for ongoing (e.g. 'Présent', 'Present')")
    bullets: list[str] = Field(description="Each mission / achievement, verbatim, without bullet symbols")


class ExtractedEducation(BaseModel):
    degree: str
    institution: str
    location: str
    start: str
    end: str
    details: list[str] = Field(description="Honours, final-year project, key courses… verbatim")


class ExtractedProject(BaseModel):
    name: str
    technologies: list[str]
    link: str = Field(description="URL of this project (GitHub, demo…) if written in the CV, else empty")
    description: list[str] = Field(description="One item per sentence or bullet, verbatim")


class ExtractedSkillGroup(BaseModel):
    category: str = Field(description="Category heading exactly as written in the CV (e.g. 'Langages', 'Outils'), empty if the CV has none")
    items: list[str] = Field(description="Each individual skill, tool or technology of this category, one per item")


class ExtractedHackathon(BaseModel):
    name: str = Field(description="Hackathon / competition / challenge name")
    result: str = Field(description="Result or role as written (e.g. '1re place', 'finaliste'), else empty")
    date: str
    description: list[str] = Field(description="What was built or done, verbatim")


class ExtractedAssociation(BaseModel):
    organization: str = Field(description="Club, association or volunteering organization")
    role: str = Field(description="Role as written (e.g. 'Membre', 'Trésorière'), else empty")
    start: str
    end: str
    description: list[str] = Field(description="Actions, verbatim")


class ExtractedLanguage(BaseModel):
    language: str = Field(description="Spoken language, e.g. Français, English")
    level: str = Field(description="Level as written, e.g. courant, B2, native")


class ExtractedProfile(BaseModel):
    full_name: str
    headline: str = Field(description="Professional title written under the name, else empty")
    email: str
    phone: str
    location: str = Field(description="City / country of the candidate")
    linkedin: str = Field(description="LinkedIn URL as written, else empty")
    website: str = Field(description="Portfolio / GitHub / personal site URL, else empty")
    summary: str = Field(description="Profile / about paragraph verbatim, else empty")
    experiences: list[ExtractedExperience] = Field(description="Professional experiences incl. internships")
    education: list[ExtractedEducation]
    projects: list[ExtractedProject] = Field(description="Academic or personal projects listed as projects")
    skills: list[ExtractedSkillGroup] = Field(description="Skills grouped as in the CV; a single group with an empty category if the CV doesn't group them")
    languages: list[ExtractedLanguage]
    hackathons: list[ExtractedHackathon] = Field(description="Hackathons, coding competitions, challenges")
    associations: list[ExtractedAssociation] = Field(description="Student clubs, associations, volunteering")
    interests: list[str] = Field(description="Hobbies / centres d'intérêt, one per item")


class ProfileOut(BaseModel):
    """Profile in the shape used by the frontend (multi-line fields joined with newlines)."""

    photo: None = None
    full_name: str
    headline: str
    email: str
    phone: str
    location: str
    linkedin: str
    website: str
    summary: str
    experiences: list[dict[str, str]]
    education: list[dict[str, str]]
    projects: list[dict[str, str]]
    skills: list[dict]
    languages: list[dict[str, str]]
    hackathons: list[dict[str, str]]
    associations: list[dict[str, str]]
    interests: list[str]
    sections: dict[str, bool]


class ProfileImportResponse(BaseModel):
    profile: ProfileOut
    method: Literal["text", "ocr"]
    warnings: list[str]


# ---------- Job offer ----------


class OfferExtractResponse(BaseModel):
    text: str


class OfferAnalyzeRequest(BaseModel):
    text: str = Field(min_length=150, max_length=30_000)


class JobAnalysis(BaseModel):
    # Empty strings rather than None: Groq's strict JSON mode handles them more reliably
    job_title: str
    company: str = ""
    location: str = Field(default="", description="City/country, plus remote/hybrid/on-site if stated")
    language: Lang = Field(description="Language the job offer is written in")
    seniority: Literal["internship", "junior", "mid", "senior", "lead", ""] = Field(
        default="", description="Level targeted by the offer; empty if it cannot be told"
    )
    contract_type: str = Field(default="", description="As written: CDI, CDD, Stage, Alternance, Freelance…")
    salary: str = Field(default="", description="As written in the offer")
    education: str = Field(default="", description="Degree/level required, as written (e.g. 'Bac+5 en informatique')")
    experience: str = Field(default="", description="Experience required, as written (e.g. '0 à 2 ans')")
    spoken_languages: list[str] = Field(default=[], description="Spoken languages required, with level as written")
    summary: str = Field(description="Two-sentence summary of the role, in the offer's language")
    required_skills: list[str] = Field(description="Hard skills/qualifications explicitly required")
    nice_to_have_skills: list[str] = Field(default=[], description="Skills presented as a plus/appreciated")
    soft_skills: list[str] = []
    responsibilities: list[str] = Field(default=[], description="Main missions, one short line each")
    keywords: list[str] = Field(
        description="ATS keywords as they literally appear in the offer (technologies, methods, certifications, job titles)"
    )


# ---------- Match ----------
# The model judges each requirement of the offer against the profile (by meaning, whatever the languages);
# the score itself is computed by code from these verdicts.


class SkillVerdict(BaseModel):
    index: int = Field(description="Index of the skill in the offer's numbered skill list")
    status: Literal["match", "partial", "missing"] = Field(
        description="match: the profile shows this skill (same thing, in any language or wording); "
        "partial: a close or weaker equivalent; missing: nothing in the profile"
    )
    evidence: str = Field(description="Short excerpt (3 to 12 words) copied verbatim from the profile that proves it; empty if missing")


class CriterionVerdict(BaseModel):
    criterion: Literal["education", "experience", "spoken_languages"]
    status: Literal["met", "partial", "unmet", "unknown"] = Field(
        description="unknown when the offer does not ask for it or the profile cannot tell"
    )
    note: str = Field(description="One short sentence in French explaining the verdict")


class MatchDraft(BaseModel):
    skills: list[SkillVerdict]
    criteria: list[CriterionVerdict]
    strengths: list[str] = Field(description="2 to 4 real assets of the candidate for this role, in French")
    tips: list[str] = Field(description="2 to 4 concrete, honest actions to improve the application, in French")
    verdict: str = Field(description="One sentence in French summing up the fit")


class SkillMatch(BaseModel):
    skill: str
    importance: Literal["required", "nice_to_have"]
    status: Literal["match", "partial", "missing"]
    evidence: str = ""


class CriterionMatch(BaseModel):
    criterion: Literal["education", "experience", "spoken_languages"]
    asked: str = Field(description="What the offer asks, as written")
    status: Literal["met", "partial", "unmet", "unknown"]
    note: str = ""


class MatchReport(BaseModel):
    score: int = Field(description="Overall fit from 0 to 100")
    skills_score: int
    criteria_score: int | None = None
    verdict: str
    skills: list[SkillMatch]
    criteria: list[CriterionMatch]
    strengths: list[str]
    tips: list[str]


class MatchRequest(BaseModel):
    profile: "ProfileIn"
    job: JobAnalysis


class KeywordCoverage(BaseModel):
    percent: int
    found: list[str]
    missing: list[str]


# ---------- Generation ----------


class ProfileIn(BaseModel):
    """Candidate profile as edited in the app (same shape as ProfileOut; the photo is not sent)."""

    full_name: str = ""
    headline: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    linkedin: str = ""
    website: str = ""
    summary: str = ""
    experiences: list[dict[str, str]] = []
    education: list[dict[str, str]] = []
    projects: list[dict[str, str]] = []
    skills: list[dict] = []
    languages: list[dict[str, str]] = []
    hackathons: list[dict[str, str]] = []
    associations: list[dict[str, str]] = []
    interests: list[str] = []
    sections: dict[str, bool] = {}


# LLM output for the tailored CV. Items point to the profile entry they rewrite ("source" index):
# companies, schools, dates and links are copied from the profile by code, so the model cannot change them.


class DraftExperience(BaseModel):
    source: int = Field(description="Index of this experience in the profile's experiences list")
    title: str = Field(description="Job title, may be translated; never upgraded (an intern stays an intern)")
    bullets: list[str] = Field(description="Rewritten achievements, most relevant to the offer first")


class DraftProject(BaseModel):
    source: int = Field(description="Index of this project in the profile's projects list")
    name: str
    description: list[str]


class DraftEducation(BaseModel):
    source: int = Field(description="Index of this entry in the profile's education list")
    degree: str = Field(description="Degree name, may be translated")
    details: list[str]


class DraftSkill(BaseModel):
    source: str = Field(description="The skill exactly as written somewhere in the profile")
    label: str = Field(description="How it is shown on the CV (same as source, or translated)")


class DraftSkillGroup(BaseModel):
    category: str
    items: list[DraftSkill]


class DraftLanguage(BaseModel):
    source: int = Field(description="Index of this language in the profile's languages list")
    language: str
    level: str


class DraftHackathon(BaseModel):
    source: int = Field(description="Index of this entry in the profile's hackathons list")
    result: str = Field(description="Result only, a few words (e.g. '2e place', '2nd place'), translated if needed; empty if none")
    project: str = Field(
        description="What the project built at THIS hackathon is, one short line (max 15 words), from its own description; empty if unknown"
    )


class DraftAssociation(BaseModel):
    source: int = Field(description="Index of this entry in the profile's associations list")
    role: str = Field(description="Role only, a few words (e.g. 'Responsable événements', 'Events lead'), without organization or dates")
    description: list[str] = Field(description="Actions of THIS association, from its own description in the profile")


class TailorDraft(BaseModel):
    headline: str = Field(description="Title under the name: real title or degree + the job sought (see rules)")
    summary: str = Field(description="3-4 line profile paragraph built only from facts in the profile")
    experiences: list[DraftExperience]
    projects: list[DraftProject]
    education: list[DraftEducation]
    skills: list[DraftSkillGroup]
    languages: list[DraftLanguage]
    hackathons: list[DraftHackathon]
    associations: list[DraftAssociation]
    interests: list[str]
    changes: list[str] = Field(description="What was changed and why, 3-6 short items, in French")


class TailorRequest(BaseModel):
    profile: ProfileIn
    job: JobAnalysis
    lang: Lang


class TailorResponse(BaseModel):
    profile: ProfileOut
    changes: list[str]
    warnings: list[str]
    coverage_before: KeywordCoverage
    coverage_after: KeywordCoverage


class CoverLetter(BaseModel):
    subject: str = Field(description="Subject line: the job title (and reference if any)")
    greeting: str
    paragraphs: list[str] = Field(description="3 or 4 paragraphs, plain prose")
    closing: str = Field(description="Closing sentence and sign-off formula, without the name")


class CoverLetterRequest(BaseModel):
    profile: ProfileIn
    job: JobAnalysis
    lang: Lang
    notes: str = Field(default="", max_length=2000, description="Candidate's own words: why this job/company, availability…")


class PdfRequest(BaseModel):
    html: str = Field(description="Self-contained HTML page of the CV (styles inline, photo as a data: URL)")
    filename: str = Field(default="CV", max_length=120)


class CoverLetterResponse(BaseModel):
    letter: CoverLetter
    warnings: list[str]


MatchRequest.model_rebuild()


# ---------- CV template from an example ----------
# The vision model describes the look of the candidate's example CV with a few closed choices;
# the app turns them into a template. Section order and the single column stay the app's (ATS).


class ExampleStyle(BaseModel):
    font: Literal["sans", "serif"] = Field(description="Main typeface family of the CV")
    header_align: Literal["left", "center"] = Field(description="Alignment of the name and contact block")
    name_size: Literal["small", "medium", "large"] = Field(description="Size of the candidate's name compared with the body text")
    name_uppercase: bool = Field(description="Name written in capital letters")
    accent: str = Field(description="Main accent colour as #rrggbb (titles, name, rules); #1b1d22 if the CV is black and white")
    name_in_accent: bool = Field(description="The name is written in the accent colour")
    headings_in_accent: bool = Field(description="Section titles are written in the accent colour")
    heading_style: Literal["underline", "bar", "filled", "plain"] = Field(
        description="Section titles: underline = a rule under or across the title; bar = a vertical bar on the left; "
        "filled = text on a coloured band; plain = no decoration"
    )
    heading_uppercase: bool = Field(description="Section titles in capital letters")
    density: Literal["airy", "normal", "compact"] = Field(description="How tightly the text is packed")
    photo: Literal["none", "round", "square"] = Field(description="Photo of the candidate and its shape")
    two_columns: bool = Field(description="The page is laid out in two columns (e.g. a sidebar)")
    description: str = Field(description="One sentence in French describing this style for the candidate")


class ExampleStyleResponse(BaseModel):
    style: ExampleStyle
    preview: str = Field(description="Small JPEG of the example's first page, as a data: URL")
    notes: list[str]
