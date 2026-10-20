import { useLayoutEffect, useRef, useState } from "react";
import type { Lang, Profile, Settings } from "../../types";
import { CvSheet } from "./CvSheet";

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

type Props = { profile: Profile; settings: Settings; lang?: Lang; className?: string; crop?: number };

/** Renders the A4 sheet scaled down to fit its container width. `crop` shows only the top part (thumbnails). */
export function ScaledSheet({ profile, settings, lang, className = "", crop }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 0, height: 0 });

  useLayoutEffect(() => {
    const el = box.current!;
    const measure = () => {
      const scale = el.clientWidth / A4_WIDTH;
      const height = (crop ? A4_HEIGHT * crop : sheet.current!.offsetHeight) * scale;
      setFit((f) => (f.scale === scale && f.height === height ? f : { scale, height }));
    };
    measure();
    // Re-measure when the container resizes or the CV content grows
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(sheet.current!);
    return () => ro.disconnect();
  }, [crop]);

  return (
    <div ref={box} className={`scale-box ${className}`} style={{ height: fit.height }}>
      <div style={{ transform: `scale(${fit.scale})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}>
        <CvSheet ref={sheet} profile={profile} settings={settings} lang={lang} />
      </div>
    </div>
  );
}
