import { useRef, type KeyboardEvent, type ReactNode } from "react";

const STEPS: Partial<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * A row of choices as one radio group: a single Tab stop on the chosen one,
 * the arrows move to the next or the one before and choose it, wrapping
 * round, and Home and End go to the ends.
 */
export function Segmented<T extends string | number>({ label, options, value, onChange }: { label: string; options: readonly (readonly [T, ReactNode])[]; value: T; onChange: (value: T) => void }) {
  const group = useRef<HTMLDivElement>(null);
  const chosen = Math.max(0, options.findIndex(([option]) => option === value));
  const key = (event: KeyboardEvent, index: number) => {
    const step = STEPS[event.key];
    const to = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : step === undefined ? -1 : (index + step + options.length) % options.length;
    const option = options[to];
    if (!option) return;
    event.preventDefault();
    onChange(option[0]);
    group.current?.querySelectorAll("button")[to]?.focus();
  };
  return (
    <div ref={group} className="segmented" role="radiogroup" aria-label={label}>
      {options.map(([option, name], index) => (
        <button key={option} type="button" role="radio" aria-checked={option === value} tabIndex={index === chosen ? 0 : -1} onClick={() => onChange(option)} onKeyDown={(event) => key(event, index)}>
          {name}
        </button>
      ))}
    </div>
  );
}
