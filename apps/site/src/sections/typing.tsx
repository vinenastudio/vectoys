import { Keyboard } from "@vectoys/keyboard";
import { useRef } from "react";
import { LazyPreview } from "../components/lazy-preview";
import { useInFocus } from "../motion";

/** The full keyboard, large and live: it follows the real keyboard, and types a word by itself once it comes into focus, until someone presses a key. */
export function Typing() {
  const stage = useRef<HTMLDivElement>(null);
  const inFocus = useInFocus(stage);
  return (
    <section className="section" id="typing" aria-labelledby="typing-title">
      <div className="section-copy section-copy-wide">
        <h2 id="typing-title">Type on it</h2>
        <p>Press keys on your own keyboard, or tap them on a phone. Each key goes down with a soft click.</p>
      </div>
      <div className="typing" ref={stage}>
        <LazyPreview className="typing-stage">{() => <Keyboard demo={inFocus} typing="fullscreen" fullscreen />}</LazyPreview>
      </div>
    </section>
  );
}
