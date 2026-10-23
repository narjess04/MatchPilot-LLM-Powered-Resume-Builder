/**
 * Calls to the FastAPI backend (proxied on /api by Vite).
 * Features still flagged in MOCK return sample data so the UI can be used before their backend exists.
 */
import { SAMPLE_JOB, SAMPLE_PROFILE } from "./data/samples";
import type { ExampleStyle, JobAnalysis, Lang, LetterResult, MatchReport, Profile, TailorResult } from "./types";

export const MOCK = {
  profileImport: false,
  linkedinIdentity: true,
  offerExtract: false,
};
export const DEMO_MODE = Object.values(MOCK).some(Boolean);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postFile<T>(path: string, field: string, file: File | File[], extra: Record<string, string> = {}): Promise<T> {
  const form = new FormData();
  [file].flat().forEach((f) => form.append(field, f));
  Object.entries(extra).forEach(([k, v]) => form.append(k, v));
  return post<T>(path, { body: form });
}

const postJson = <T,>(path: string, data: unknown) =>
  post<T>(path, { body: JSON.stringify(data), headers: { "Content-Type": "application/json" } });

async function post<T>(path: string, init: RequestInit): Promise<T> {
  return (await send(path, init)).json();
}

async function send(path: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method: "POST", credentials: "same-origin", ...init });
  } catch {
    throw new Error("Serveur injoignable. Le backend est-il lancé ?");
  }
  if (!res.ok) {
    const detail = await res.json().then((d) => d.detail).catch(() => null);
    if (res.status === 401) throw new Error("Votre session a expiré : reconnectez-vous.");
    throw new Error(typeof detail === "string" ? detail : `Erreur ${res.status}`);
  }
  return res;
}

export type ProfileImport = {
  profile: Profile;
  /** "ocr" when the document was scanned / a photo and had to be read as an image */
  method: "text" | "ocr";
  /** Items the model returned that could not be found in the document */
  warnings: string[];
};

/** Ancien CV, PDF LinkedIn ou photo -> profil structuré. */
export async function importProfileFromFile(file: File, source: "cv" | "linkedin-pdf"): Promise<ProfileImport> {
  if (MOCK.profileImport) {
    await wait(2400);
    return { profile: structuredClone(SAMPLE_PROFILE), method: "text", warnings: [] };
  }
  return postFile<ProfileImport>("/profile/import", "file", file, { source });
}

/** Connexion LinkedIn (OpenID) : LinkedIn ne fournit que l'identité, l'e-mail et la photo. */
export async function linkedinSignIn(): Promise<Partial<Profile>> {
  if (MOCK.linkedinIdentity) {
    await wait(1800);
    const { full_name, email, linkedin, location } = SAMPLE_PROFILE;
    return { full_name, email, linkedin, location };
  }
  throw new Error("La connexion LinkedIn n'est pas encore configurée.");
}

/** Captures d'écran de l'offre (dans l'ordre de lecture) -> texte de l'annonce seule, sans l'interface du site. */
export async function extractOfferFromImages(images: File[]): Promise<string> {
  if (MOCK.offerExtract) {
    await wait(2200);
    return SAMPLE_JOB;
  }
  const { text } = await postFile<{ text: string }>("/offer/extract", "images", images);
  return text;
}

/** CV exemple (PDF ou image) -> son style (police, couleur, titres…), repris par « Mon modèle ». */
export const templateFromExample = (file: File) => postFile<ExampleStyle>("/template/from-example", "file", file);

/** Texte de l'offre -> analyse structurée (compétences, mots-clés ATS, prérequis). */
export const analyzeOffer = (text: string) => postJson<JobAnalysis>("/offer/analyze", { text });

// The photo stays in the browser: it is not needed to write the CV or the letter
const withoutPhoto = ({ photo: _photo, ...profile }: Profile) => profile;

/** Profil + analyse de l'offre -> score de correspondance, compétence par compétence (quelles que soient les langues). */
export const matchProfile = (profile: Profile, job: JobAnalysis) =>
  postJson<MatchReport>("/match", { profile: withoutPhoto(profile), job });

/** Profil + analyse de l'offre -> CV réécrit pour l'offre, avec contrôles anti-invention. */
export const tailorCv = (profile: Profile, job: JobAnalysis, lang: Lang) =>
  postJson<TailorResult>("/tailor-cv", { profile: withoutPhoto(profile), job, lang });

/** Profil + analyse de l'offre (+ notes du candidat) -> lettre de motivation. */
export const writeCoverLetter = (profile: Profile, job: JobAnalysis, lang: Lang, notes: string) =>
  postJson<LetterResult>("/cover-letter", { profile: withoutPhoto(profile), job, lang, notes });

/** Page HTML du CV -> fichier PDF A4 (vrai texte, liens cliquables). */
export async function exportCvPdf(html: string, filename: string): Promise<Blob> {
  const res = await send("/export/cv-pdf", {
    body: JSON.stringify({ html, filename }),
    headers: { "Content-Type": "application/json" },
  });
  return res.blob();
}
