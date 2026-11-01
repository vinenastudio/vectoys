import { DESK, KICKFLIP, Laptop, type LaptopHandle } from "@vectoys/laptop";
import { scrub } from "@vinena/vectoys";
import { useScrub } from "@vinena/vectoys-react";
import { useEffect, useRef, type RefObject } from "react";
import { useReducedMotion } from "../motion";

// How many screens tall the track is, so how long the trick stays pinned.
const SCREENS = 3;
const START = scrub(0, KICKFLIP);

/** With reduced motion, the trick's three moments: straight on, in the air and open on the desk. */
const STILLS = [
  [0, "Straight on"],
  [0.47, "In the air"],
  [1, "On the desk"],
] as const;

/** What the display shows: how far the trick has gone, which the scroll fills in through the ref, or `value` as a still frame. */
function Display({ percent, value = 0 }: { percent?: RefObject<HTMLSpanElement | null>; value?: number }) {
  return (
    <div className="scrub-screen">
      <p className="scrub-screen-label">Kickflip</p>
      <p className="scrub-screen-count">
        <span ref={percent}>{value}</span>%
      </p>
    </div>
  );
}

/** The trick pinned while the page scrolls past it, every frame set through the laptop's handle. */
function Pinned() {
  const track = useRef<HTMLDivElement>(null);
  const laptop = useRef<LaptopHandle>(null);
  const percent = useRef<HTMLSpanElement>(null);
  const { progress } = useScrub(track, { screens: SCREENS });

  useEffect(() => {
    const draw = (t: number) => {
      laptop.current?.set(scrub(t, KICKFLIP));
      if (percent.current) percent.current.textContent = String(Math.round(t * 100));
    };
    draw(progress.get());
    return progress.subscribe(draw);
  }, [progress]);

  return (
    <div className="scrub-track" ref={track} style={{ height: `${SCREENS * 100}vh` }}>
      <div className="scrub-pin" data-replay-block="">
        <div className="trick-slot">
          <div className="trick-room">
            <Laptop eye={DESK} free {...START} ref={laptop} label="A laptop that flips in the air and lands open as the page scrolls">
              <Display percent={percent} />
            </Laptop>
          </div>
        </div>
      </div>
    </div>
  );
}

/** With reduced motion: the trick as still frames, in the page's flow. */
function Stills() {
  return (
    <div className="trick-stills">
      {STILLS.map(([t, caption]) => (
        <figure key={t} className="trick-still">
          <div className="trick-slot">
            <div className="trick-room">
              <Laptop eye={DESK} free {...scrub(t, KICKFLIP)} label={`A laptop: ${caption.toLowerCase()}`}>
                <Display value={Math.round(t * 100)} />
              </Laptop>
            </div>
          </div>
          <figcaption>{caption}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function Trick() {
  const reduced = useReducedMotion();
  return (
    <section className="section" id="trick" aria-labelledby="trick-title">
      <div className="section-copy section-copy-wide">
        <h2 id="trick-title">Kickflip it</h2>
        <p>
          With <code>free</code>, the laptop turns any way and leaves its box. <code>flat</code> eases it from the straight-on shot into perspective, and{" "}
          <code>KICKFLIP</code> plays the whole trick from the scroll.
        </p>
      </div>
      {reduced ? <Stills /> : <Pinned />}
    </section>
  );
}
