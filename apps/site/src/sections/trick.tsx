import { DESK, KICKFLIP, Laptop, type LaptopHandle, type TrickPose } from "@vectoys/laptop";
import { clamp, scrub } from "@vinena/vectoys";
import { useScrub } from "@vinena/vectoys-react";
import { useEffect, useRef, type RefObject } from "react";
import { useReducedMotion } from "../motion";

// How many screens tall the track is, so how long the scene stays pinned:
// the kickflip over the first KICK of it, then the chapters.
const SCREENS = 7;
export const KICK = 0.42;

/** A share `u` of the chapters, as a share of the whole scroll. */
const chapter = (u: number) => KICK + u * (1 - KICK);

/*
 * One laptop, one timeline from 0 to 1: KICKFLIP, from the straight-on shot
 * to open on the desk, then a glide to the left turning to face the words on
 * the right, across to the right turning to face the words on the left, and
 * back to the middle, front on. The kickflip ends a whole turn round, so the
 * chapters turn about 360. `x` is the glide, -1 to 1, which the page scales
 * to its width.
 */
export const TIMELINE = [
  ...KICKFLIP.map((key) => ({ ...key, at: key.at * KICK })),
  { at: chapter(0.08), x: 0, yaw: 360, pitch: 15 },
  { at: chapter(0.3), x: -1, yaw: 380 },
  { at: chapter(0.46) },
  { at: chapter(0.66), x: 1, yaw: 340 },
  { at: chapter(0.8) },
  { at: chapter(0.95), x: 0, yaw: 360, pitch: 12 },
];

/** The scene at `t`, its glide scaled by `reach`, a share of the laptop's width. */
const pose = (t: number, reach: number): Partial<TrickPose> => {
  const at = scrub(t, TIMELINE);
  return { ...at, x: at.x * reach };
};

// How far the glide goes on a wide page, in shares of the laptop's width.
const REACH = 0.5;

/** Each chapter's words, the side they stand on and the stretch of the scroll they show for. */
const CHAPTERS = [
  {
    side: "right",
    from: chapter(0.26),
    to: chapter(0.5),
    title: "The scroll drives it",
    text: "One number from the scroll sets the flip, the lid, the turn and the glide on every frame, with no React render.",
  },
  {
    side: "left",
    from: chapter(0.6),
    to: chapter(0.84),
    title: "The screen stays live",
    text: "The display is plain HTML laid onto the glass. The counter and the list on it fill as you scroll.",
  },
] as const;

// How long a chapter takes to fade in and out, as a share of the scroll.
const FADE = 0.025;

/** The steps the list on the display ticks off, and where along the scroll each is done. */
const STEPS = [
  ["Land the kickflip", KICK],
  ["Glide to the left", chapter(0.3)],
  ["Glide to the right", chapter(0.66)],
  ["Face the front", chapter(0.95)],
] as const;

/** With reduced motion, a few moments of the one timeline, the chapters with their words. */
const STILLS = [
  { t: 0, caption: "Straight on" },
  { t: 0.47 * KICK, caption: "In the air" },
  { t: chapter(0.4), caption: "Facing the words", words: CHAPTERS[0] },
  { t: chapter(0.75), caption: "Turned the other way", words: CHAPTERS[1] },
] as const;

/**
 * What the display shows: how far the scroll is and the steps done so far.
 * Pinned, the scroll fills them in through the refs; as a still frame it
 * shows `value` and the steps done by then.
 */
function Display({ percent, steps, value = 0 }: { percent?: RefObject<HTMLSpanElement | null>; steps?: RefObject<HTMLOListElement | null>; value?: number }) {
  return (
    <div className="scrub-screen">
      <p className="scrub-screen-label">Scrolled</p>
      <p className="scrub-screen-count">
        <span ref={percent}>{Math.round(value * 100)}</span>%
      </p>
      <ol ref={steps} className="scrub-screen-steps">
        {STEPS.map(([step, at]) => (
          <li key={step} data-done={!percent && value >= at ? "" : undefined}>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Words({ title, text }: { title: string; text: string }) {
  return (
    <>
      <h3>{title}</h3>
      <p>{text}</p>
    </>
  );
}

/** The scene pinned while the page scrolls past it, every frame set through the one laptop's handle. */
function Pinned() {
  const track = useRef<HTMLDivElement>(null);
  const laptop = useRef<LaptopHandle>(null);
  const percent = useRef<HTMLSpanElement>(null);
  const steps = useRef<HTMLOListElement>(null);
  const chapters = useRef<(HTMLDivElement | null)[]>([]);
  const { progress } = useScrub(track, { screens: SCREENS });

  useEffect(() => {
    // How far the glide goes: none on a narrow page, where the words sit under the laptop.
    let reach = 0;
    const draw = (t: number) => {
      laptop.current?.set(pose(t, reach));
      if (percent.current) percent.current.textContent = String(Math.round(t * 100));
      steps.current?.querySelectorAll("li").forEach((step, index) => step.toggleAttribute("data-done", t >= (STEPS[index]?.[1] ?? 1)));
      CHAPTERS.forEach(({ from, to }, index) => {
        const words = chapters.current[index];
        if (words) words.style.opacity = String(clamp((t - from) / FADE, 0, 1) * clamp((to - t) / FADE, 0, 1));
      });
    };
    const resized = () => {
      reach = matchMedia("(min-width: 900px)").matches ? REACH : 0;
      draw(progress.get());
    };
    resized();
    addEventListener("resize", resized, { passive: true });
    const stop = progress.subscribe(draw);
    return () => {
      stop();
      removeEventListener("resize", resized);
    };
  }, [progress]);

  return (
    <div className="scrub-track" ref={track} style={{ height: `${SCREENS * 100}vh` }}>
      <div className="scrub-pin" data-replay-block="">
        <div className="trick-slot">
          <div className="trick-room">
            <Laptop eye={DESK} look="realistic" free {...pose(0, 0)} ref={laptop} label="A laptop that flips, lands open and turns toward the words as the page scrolls">
              <Display percent={percent} steps={steps} />
            </Laptop>
          </div>
        </div>
        {CHAPTERS.map((words, index) => (
          <div
            key={words.title}
            className={`scrub-chapter scrub-chapter-${words.side}`}
            ref={(element) => {
              chapters.current[index] = element;
            }}
          >
            <Words {...words} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** With reduced motion: moments of the one timeline as still frames, in the page's flow, with no pinning. */
function Stills() {
  return (
    <div className="trick-stills">
      {STILLS.map((still) => (
        <figure key={still.t} className="trick-still">
          <div className="trick-room">
            <Laptop eye={DESK} look="realistic" free {...pose(still.t, 0)} label={`A laptop: ${still.caption.toLowerCase()}`}>
              <Display value={still.t} />
            </Laptop>
          </div>
          <figcaption>
            {"words" in still ? (
              <div className="scrub-chapter">
                <Words {...still.words} />
              </div>
            ) : (
              still.caption
            )}
          </figcaption>
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
        <h2 id="trick-title">Kickflip it, then scrub it</h2>
        <p>
          With <code>free</code>, the laptop turns any way and <code>flat</code> eases it from the straight-on shot into perspective. One <code>scrub</code>{" "}
          timeline from <code>useScrub</code> plays <code>KICKFLIP</code> and the turns after it through the laptop's handle.
        </p>
      </div>
      {reduced ? <Stills /> : <Pinned />}
    </section>
  );
}
