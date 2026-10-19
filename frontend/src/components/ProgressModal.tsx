import { useEffect, useState } from "react";

type Props = { title: string; stages: string[]; estimatedMs: number };

/** Blocking overlay that walks through the stages while a request runs; the parent unmounts it when done. */
export function ProgressModal({ title, stages, estimatedMs }: Props) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (current >= stages.length - 1) return;
    const t = setTimeout(() => setCurrent((c) => c + 1), estimatedMs / stages.length);
    return () => clearTimeout(t);
  }, [current, stages.length, estimatedMs]);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-box">
        <div className="spinner" />
        <h2 style={{ fontSize: 20 }}>{title}</h2>
        <div className="stages">
          {stages.map((s, i) => (
            <div key={s} className={`stage${i < current ? " ok" : i === current ? " cur" : ""}`}>
              <span className="d" />
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
