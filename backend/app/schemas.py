"""Data models shared by the API and the LLM agents.

The models used as LLM output formats (CVData, JobAnalysis, MatchReport,
TailoredCV, CoverLetter) are sent to Claude as JSON schemas, so field
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


class JobAnalysis(BaseModel):
    job_title: str
    company: str | None = None
    location: str | None = None
    language: Lang = Field(description="Language the job offer is written in")
    seniority: str | None = Field(default=None, description="e.g. Internship, Junior, Mid, Senior")
    contract_type: str | None = None
    summary: str = Field(description="Two-sentence summary of the role")
    required_skills: list[str] = Field(description="Hard skills/qualifications explicitly required")
    nice_to_have_skills: list[str] = []
    soft_skills: list[str] = []
    responsibilities: list[str] = []
    keywords: list[str] = Field(
        description="ATS keywords as they literally appear in the offer (technologies, methods, certifications, job titles)"
    )


# ---------- Match ----------


class MissingSkill(BaseModel):
    skill: str
    importance: Literal["required", "nice_to_have"]
    transferable_evidence: str | None = Field(
        default=None,
        description="Something real in the CV that partially covers this skill, if any",
    )


class MatchReport(BaseModel):
    score: int = Field(description="Overall fit from 0 to 100")
    verdict: str = Field(description="One-sentence verdict")
    matched_skills: list[str]
    missing_skills: list[MissingSkill]
    strengths: list[str] = Field(description="Most relevant assets of the candidate for this role")
    relevant_experiences: list[str] = Field(description="Titles of the CV experiences/projects most relevant to the role")
    tips: list[str] = Field(description="Concrete, honest actions to improve the application")


class KeywordCoverage(BaseModel):
    percent: int
    found: list[str]
    missing: list[str]


# ---------- Generation ----------


class TailoredCV(BaseModel):
    cv: CVData
    changes: list[str] = Field(description="Short list of what was changed and why")


class CoverLetter(BaseModel):
    subject: str
    greeting: str
    paragraphs: list[str]
    closing: str


# ---------- API payloads ----------


class AnalyzeResponse(BaseModel):
    cv_text: str
    cv: CVData
    job: JobAnalysis
    match: MatchReport
    coverage: KeywordCoverage


class TailorRequest(BaseModel):
    cv_text: str
    cv: CVData
    job: JobAnalysis
    match: MatchReport
    ui_lang: Lang = "fr"


class TailorResponse(BaseModel):
    cv: CVData
    changes: list[str]
    warnings: list[str]
    coverage_before: KeywordCoverage
    coverage_after: KeywordCoverage


class CoverLetterRequest(BaseModel):
    cv: CVData
    job: JobAnalysis
    notes: str | None = Field(default=None, description="Optional extra info from the candidate (motivation, availability…)")


class ExportCVRequest(BaseModel):
    cv: CVData
    language: Lang


class ExportLetterRequest(BaseModel):
    letter: CoverLetter
    cv: CVData
    job: JobAnalysis
