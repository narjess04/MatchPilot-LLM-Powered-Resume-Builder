/**
 * Calls to the FastAPI backend (proxied on /api by Vite).
 * Features still flagged in MOCK return sample data so the UI can be used before their backend exists.
 */
import { SAMPLE_JOB, SAMPLE_PROFILE } from "./data/samples";
import type { Profile } from "./types";

export const MOCK = {
  profileImport: false,
  linkedinIdentity: true,
  offerExtract: true,
};
export const DEMO_MODE = Object.values(MOCK).some(Boolean);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postFile<T>(path: string, field: string, file: File, extra: Record<string, string> = {}): Promise<T> {
  const form = new FormData();
  form.append(field, file);
  Object.entries(extra).forEach(([k, v]) => form.append(k, v));
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method: "POST", body: form, credentials: "same-origin" });
  } catch {
    throw new Error("Serveur injoignable. Le backend est-il lancé ?");
  }
  if (!res.ok) {
    const detail = await res.json().then((d) => d.detail).catch(() => null);
    if (res.status === 401) throw new Error("Votre session a expiré : reconnectez-vous.");
    throw new Error(typeof detail === "string" ? detail : `Erreur ${res.status}`);
  }
  return res.json();
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

/** Capture d'écran de l'offre -> texte (lecture d'image côté backend). */
export async function extractOfferFromImage(image: File): Promise<string> {
  if (MOCK.offerExtract) {
    await wait(2200);
    return SAMPLE_JOB;
  }
  const { text } = await postFile<{ text: string }>("/offer/extract", "image", image);
  return text;
}
