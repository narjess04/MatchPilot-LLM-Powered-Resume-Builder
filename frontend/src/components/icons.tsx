import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const stroke = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const IconCheck = (p: P) => <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.4} {...p}><path d="M4 12l5 5L20 6" /></svg>;
export const IconX = (p: P) => <svg viewBox="0 0 24 24" {...stroke} strokeWidth={3} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconChevron = (p: P) => <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2} {...p}><path d="M6 9l6 6 6-6" /></svg>;
export const IconArrow = (p: P) => <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.4} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const IconSun = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
export const IconUser = (p: P) => <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>;
export const IconBriefcase = (p: P) => <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2} {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></svg>;
export const IconDoc = (p: P) => <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2} {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>;
export const IconSparkle = (p: P) => <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2} {...p}><path d="M12 3l1.8 4.6L18 9.5l-4.2 1.9L12 16l-1.8-4.6L6 9.5l4.2-1.9z" /><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></svg>;
export const IconFileUp = (p: P) => <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2} {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3" /></svg>;
export const IconPen = (p: P) => <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2} {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>;
export const IconImage = (p: P) => <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2} {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M21 16l-5-5-8 8" /></svg>;
export const IconDownload = (p: P) => <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2} {...p}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>;
export const IconCopy = (p: P) => <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2} {...p}><rect x="8" y="3" width="13" height="15" rx="2" /><path d="M16 21H5a2 2 0 0 1-2-2V8" /></svg>;
export const IconInfo = (p: P) => <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>;
export const IconLogout = (p: P) => <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>;
export const IconPlay = (p: P) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M7 4.5v15l13-7.5z" /></svg>;
export const IconLinkedIn = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.06c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.77 2.65 4.77 6.1V21h-4v-5.2c0-1.24-.02-2.84-1.73-2.84-1.73 0-2 1.35-2 2.75V21h-4z" />
  </svg>
);

export const LogoMark = () => <img className="logo-mark" src="/logo.png" alt="" width={34} height={34} />;
