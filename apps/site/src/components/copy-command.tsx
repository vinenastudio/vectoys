import { useEffect, useState } from "react";
import { track } from "../analytics";
import { CheckIcon, CopyIcon } from "./icons";

/** Copies `text` to the clipboard, and whether it just did. `onCopy` runs once the copy works. */
function useCopy(text: string, onCopy?: () => void) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const reset = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(reset);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.();
    } catch {
      // Without clipboard access the text stays on screen to select by hand.
    }
  };
  return { copied, copy };
}

/** The button that copies, and what it says to a screen reader once it has. */
function CopyButton({ label, copied, copy }: { label: string; copied: boolean; copy: () => void }) {
  return (
    <>
      <button type="button" className="command-copy" onClick={copy} aria-label={label} data-copied={copied}>
        <span className="swap swap-copy">
          <CopyIcon />
        </span>
        <span className="swap swap-check">
          <CheckIcon />
        </span>
      </button>
      <span className="visually-hidden" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </>
  );
}

/** A shell command with a button that copies it. */
export function CopyCommand({ command, className = "" }: { command: string; className?: string }) {
  const { copied, copy } = useCopy(command);
  return (
    <div className={`command ${className}`}>
      <code>
        <span className="command-prompt" aria-hidden="true">
          ${" "}
        </span>
        {command}
      </code>
      <CopyButton label={`Copy ${command}`} copied={copied} copy={copy} />
    </div>
  );
}

/** A prompt to paste into a coding agent, with a button that copies it. A copy sends `prompt_copy` with `placement`. */
export function CopyPrompt({ prompt, caption, placement }: { prompt: string; caption: string; placement: string }) {
  const { copied, copy } = useCopy(prompt, () => track("prompt_copy", { placement }));
  return (
    <figure className="prompt">
      <figcaption>{caption}</figcaption>
      <p>{prompt}</p>
      <CopyButton label={`Copy ${caption.toLowerCase()}`} copied={copied} copy={copy} />
    </figure>
  );
}
