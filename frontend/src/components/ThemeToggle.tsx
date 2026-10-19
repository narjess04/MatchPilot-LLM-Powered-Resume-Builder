import { IconSun } from "./icons";

const KEY = "mp-theme";

export function initTheme() {
  try {
    const t = localStorage.getItem(KEY);
    if (t) document.documentElement.dataset.theme = t;
  } catch {
    /* storage unavailable */
  }
}

export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try {
      localStorage.setItem(KEY, root.dataset.theme);
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <button className="icon-btn" onClick={toggle} aria-label="Changer de thème">
      <IconSun />
    </button>
  );
}
