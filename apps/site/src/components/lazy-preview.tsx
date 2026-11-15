import { startTransition, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A preview well that draws its preview only once it comes near the screen,
 * so the page's HTML stays small. The previews are interactive and animate,
 * so session replays and the text in llms-full.txt leave them out.
 */
export function LazyPreview({ className, children }: { className: string; children: () => ReactNode }) {
  const well = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const element = well.current;
    if (!element || shown) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // A transition, so React draws the previews that come in together in small slices, not in one long task.
        if (entry?.isIntersecting) startTransition(() => setShown(true));
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [shown]);
  return (
    <div className={className} ref={well} data-replay-block="" data-llms="skip">
      {shown && children()}
    </div>
  );
}
