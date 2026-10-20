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

/**
 * Opens the browser's print dialog with only the CV (rendered in `.print-root`), as A4 pages of real text.
 * The page title becomes the file name the browser suggests: "CV_Prenom-Nom.pdf".
 */
export function printCv(fullName: string) {
  const previousTitle = document.title;
  document.title = cvFileName(fullName);
  document.body.classList.add("print-cv");
  const restore = () => {
    document.title = previousTitle;
    document.body.classList.remove("print-cv");
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}
