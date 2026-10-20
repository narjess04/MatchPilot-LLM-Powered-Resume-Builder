import { A4_HEIGHT, A4_WIDTH } from "../features/template/CvSheet";
import type { Lang } from "../types";

/** "Sarah Ben Ali" -> "CV_Sarah-Ben-Ali" (no accents or symbols, safe as a file name). */
export function cvFileName(fullName: string) {
  const slug = fullName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^\w-]/g, ""))
    .filter(Boolean)
    .join("-");
  return `CV_${slug || "MatchPilot"}`;
}

/** The app's CSS rules (same-origin sheets), so the PDF looks exactly like the preview. */
function appCss(): string {
  return [...document.styleSheets]
    .flatMap((sheet) => {
      try {
        return [...sheet.cssRules].map((r) => r.cssText);
      } catch {
        return []; // cross-origin sheet (web fonts)
      }
    })
    .join("\n");
}

/**
 * Self-contained HTML page of a rendered CV sheet, for the server's PDF export.
 * When the sheet fits on one page it is clipped to exactly one A4 page (its scaled layout box is taller).
 */
export function cvPdfHtml(sheet: HTMLElement, lang: Lang, fits: boolean): string {
  // 297 mm is 1122.5 px: one pixel less avoids an empty second page
  const box = fits ? `width:${A4_WIDTH}px;height:${A4_HEIGHT - 1}px;overflow:hidden;` : `width:${A4_WIDTH}px;`;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<style>${appCss()}</style>
<style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff!important}</style>
</head><body><div style="${box}position:relative">${sheet.outerHTML}</div></body></html>`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
