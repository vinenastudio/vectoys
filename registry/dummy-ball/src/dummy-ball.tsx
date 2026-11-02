import type { CSSProperties } from "react";

export type DummyBallProps = {
  /** What the item shows, for assistive technology. */
  label?: string;
  /** The ball's color; by default the page's `--vectoys-finish`. */
  finish?: string;
  className?: string;
  style?: CSSProperties;
};

/** Dummy ball: a flat ball with a highlight. */
export function DummyBall({ label = "Dummy ball", finish = "var(--vectoys-finish, #5b7cfa)", className, style }: DummyBallProps) {
  return (
    <div role="img" aria-label={label} className={className} style={style}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
        <circle cx="50" cy="50" r="40" style={{ fill: finish }} />
        <circle cx="38" cy="36" r="10" style={{ fill: "var(--vectoys-surface, #f5f5f5)", opacity: 0.6 }} />
      </svg>
    </div>
  );
}

/** How the vectoys.com gallery shows the item on its card, with no props. */
export const Demo = () => <DummyBall />;
