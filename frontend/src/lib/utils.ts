import { allSkills, type Profile } from "../types";

export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase() || "?";

export const dates = (x: { start: string; end: string }) => [x.start, x.end].filter(Boolean).join(" – ");

/** Splits a multi-line field into bullet points, dropping leading "-" or "•". */
export const lines = (txt: string) =>
  txt.split("\n").map((l) => l.replace(/^[-•]\s*/, "").trim()).filter(Boolean);

export function completion(p: Profile) {
  const checks: [string, boolean][] = [
    ["Photo", !!p.photo],
    ["Nom et titre", !!(p.full_name && p.headline)],
    ["E-mail et téléphone", !!(p.email && p.phone)],
    ["Résumé « À propos »", p.summary.trim().length > 40],
    ["Au moins une expérience", p.experiences.length > 0],
    ["Formation", p.education.length > 0],
    ["Au moins 5 compétences", allSkills(p).length >= 5],
    ["Langues", p.languages.length > 0],
  ];
  return { checks, pct: Math.round((100 * checks.filter((c) => c[1]).length) / checks.length) };
}

/** Center-crops an image to a square and downsizes it so it stays light in storage. */
export function readSquareImage(file: File, max = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const size = Math.min(max, side);
      const canvas = Object.assign(document.createElement("canvas"), { width: size, height: size });
      canvas.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Image illisible."));
    img.src = URL.createObjectURL(file);
  });
}

export const fileExt = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";


/** Description shown on one line after a hackathon's name, or null when it is too long for a single line. */
export function inlineDescription(description: string, max = 140): string | null {
  const text = lines(description).map((l) => l.replace(/[\s.;]+$/, "")).join(" ; ");
  return text && text.length <= max ? text : null;
}
