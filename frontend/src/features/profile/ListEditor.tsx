import { useRef, useState, type ReactNode } from "react";
import { IconChevron, IconX } from "../../components/icons";

export type FieldDef<T> = { key: keyof T & string; label: string; textarea?: boolean; placeholder?: string; wide?: boolean };

type Props<T extends Record<string, string>> = {
  title: string;
  addLabel: string;
  empty: string;
  items: T[];
  fields: FieldDef<T>[];
  head: (item: T) => [string, string];
  blank: T;
  onChange: (items: T[]) => void;
  /** Extra control in the card header (e.g. "remove this section") */
  action?: ReactNode;
};

/** Card with a list of collapsible, editable entries (experiences, education…). */
export function ListEditor<T extends Record<string, string>>({ title, addLabel, empty, items, fields, head, blank, onChange, action }: Props<T>) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const justAdded = useRef<number | null>(null);

  const toggle = (i: number) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const add = () => {
    justAdded.current = items.length;
    onChange([...items, { ...blank }]);
    setOpen((s) => new Set(s).add(items.length));
  };

  const remove = (i: number) => {
    onChange(items.filter((_, k) => k !== i));
    setOpen(new Set());
  };

  const setField = (i: number, key: keyof T, value: string) =>
    onChange(items.map((x, k) => (k === i ? { ...x, [key]: value } : x)));

  return (
    <div className="card">
      <div className="card-head">
        <h2>{title}</h2>
        {action ?? <span className="muted small">{items.length || ""}</span>}
      </div>
      {!items.length && <p className="empty">{empty}</p>}

      <div className="items">
        {items.map((item, i) => {
          const [t, s] = head(item);
          const isOpen = open.has(i);
          return (
            <div key={i} className={`item${isOpen ? " open" : ""}`}>
              <button type="button" className="item-head" onClick={() => toggle(i)} aria-expanded={isOpen}>
                <div className="t"><b>{t}</b><span>{s}</span></div>
                <IconChevron className="i chev" />
              </button>
              {isOpen && (
                <div className="item-body">
                  <div className="grid-2">
                    {fields.map((f, fi) => (
                      <label key={f.key} className={`field${f.textarea || f.wide ? " span-2" : ""}`}>
                        {f.label}
                        {f.textarea ? (
                          <textarea value={item[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setField(i, f.key, e.target.value)} />
                        ) : (
                          <input
                            value={item[f.key] ?? ""}
                            placeholder={f.placeholder}
                            autoFocus={justAdded.current === i && fi === 0}
                            onChange={(e) => setField(i, f.key, e.target.value)}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                  <div className="row-end">
                    <button type="button" className="del-btn" onClick={() => remove(i)}><IconX /> Supprimer</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" className="add-btn" style={{ marginTop: items.length ? 12 : 0 }} onClick={add}>+ {addLabel}</button>
    </div>
  );
}
