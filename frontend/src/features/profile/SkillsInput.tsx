import { useRef, useState } from "react";
import { IconX } from "../../components/icons";

type Props = { skills: string[]; onChange: (skills: string[]) => void; placeholder?: string; autoFocus?: boolean };

/** "React, Node.js; SQL • Git" -> ["React", "Node.js", "SQL", "Git"] */
export const splitList = (text: string) =>
  text.split(/[,;•|\n\t]+/).map((s) => s.replace(/^[-*·]\s*/, "").trim()).filter(Boolean);

export function SkillsInput({ skills, onChange, placeholder = "Ex. React, SQL, gestion de projet…", autoFocus }: Props) {
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const addMany = (text: string) => {
    const next = [...skills];
    for (const s of splitList(text)) {
      if (!next.some((x) => x.toLowerCase() === s.toLowerCase())) next.push(s);
    }
    if (next.length !== skills.length) onChange(next);
    setValue("");
  };

  return (
    <div className="tag-input" onClick={() => input.current?.focus()}>
      {skills.map((s, i) => (
        <span key={s} className="chip">
          {s}
          <button
            type="button"
            aria-label={`Retirer ${s}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange(skills.filter((_, k) => k !== i));
            }}
          >
            <IconX />
          </button>
        </span>
      ))}
      <input
        ref={input}
        value={value}
        autoFocus={autoFocus}
        placeholder={skills.length ? "" : placeholder}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => addMany(value)}
        // A pasted list is split into separate skills right away
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (splitList(text).length > 1) {
            e.preventDefault();
            addMany(value + text);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "," || e.key === ";") {
            e.preventDefault();
            addMany(value);
          } else if (e.key === "Backspace" && !value && skills.length) {
            onChange(skills.slice(0, -1));
          }
        }}
      />
    </div>
  );
}
