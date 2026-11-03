import { CopyCommand, CopyPrompt } from "../components/copy-command";
import { REPO, addCommand } from "../registry";

const CONTRIBUTING = `${REPO}/blob/main/CONTRIBUTING.md`;

/** The prompt that has a coding agent make, check, preview and send in a toy. */
export const SUBMIT_PROMPT =
  "Run npx @vinena/vectoys-cli skill and follow it. Make a new vectoys toy: a spinning top. Create it with npx @vinena/vectoys-cli create spinning-top. Then, in its folder, run npx @vinena/vectoys-cli check . until every check passes, run npx @vinena/vectoys-cli preview . --open and look at it in light and dark mode and at every angle, and send it in with npx @vinena/vectoys-cli submit .";

/** The four commands the agent runs, in order. */
export const SUBMIT_COMMANDS = [
  "npx @vinena/vectoys-cli create spinning-top",
  "npx @vinena/vectoys-cli check .",
  "npx @vinena/vectoys-cli preview . --open",
  "npx @vinena/vectoys-cli submit .",
];

const QUALITY = [
  "It is a generic object, with no product, logo or brand name.",
  "It looks right in light and dark mode.",
  "It respects reduced motion.",
  "It works with a keyboard and a screen reader.",
  "It renders on the server.",
  "It stays small, under 96 kilobytes.",
  "It turns when dragged and fills the screen. The create command sets this up.",
];

/** The /submit page: the prompt and commands for an agent first, then the same steps by hand, what a good toy is, and what happens after. */
export function Submit() {
  return (
    <>
      <section className="hero" aria-labelledby="submit-title">
        <div className="toys-intro">
          <h1 id="submit-title">Submit a toy</h1>
          <p className="lede">Anyone can make a toy and send it in. We review every one and list it in the gallery with your name.</p>
        </div>
      </section>
      <div className="sections submit">
        <section className="submit-part" aria-labelledby="submit-agent">
          <h2 id="submit-agent">Let your agent do it</h2>
          <p className="submit-note">Give this prompt to Claude Code, Codex or Cursor. Change "a spinning top" to your own idea.</p>
          <CopyPrompt prompt={SUBMIT_PROMPT} caption="Prompt to submit a toy" placement="submit" />
          <p className="submit-note">
            These are the commands it runs. After <code className="inline">cd spinning-top</code>, check, preview and submit take <code className="inline">.</code>, the
            folder you are in.
          </p>
          {SUBMIT_COMMANDS.map((command) => (
            <CopyCommand key={command} command={command} />
          ))}
        </section>
        <section className="submit-part" aria-labelledby="submit-steps">
          <h2 id="submit-steps">By hand</h2>
          <ol className="submit-steps">
            <li>
              <p>
                Make a new toy from the starter. Then go into its folder and install its packages with <code className="inline">cd spinning-top && npm install</code>. The next commands run in that folder.
              </p>
              <CopyCommand command="npx @vinena/vectoys-cli create spinning-top" />
            </li>
            <li>
              <p>
                Run the automated checks. To see it in light and dark mode, run <code className="inline">npx @vinena/vectoys-cli preview . --open</code>.
              </p>
              <CopyCommand command="npx @vinena/vectoys-cli check ." />
            </li>
            <li>
              <p>Submit it. This runs the check again, then opens a pull request. It needs the GitHub CLI (gh) and bun 1.3.2 or newer.</p>
              <CopyCommand command="npx @vinena/vectoys-cli submit ." />
            </li>
          </ol>
        </section>
        <section className="submit-part" aria-labelledby="submit-quality">
          <h2 id="submit-quality">What makes a good toy</h2>
          <ul className="submit-list">
            {QUALITY.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <section className="submit-part" aria-labelledby="submit-next">
          <h2 id="submit-next">What happens next</h2>
          <ol className="submit-list">
            <li>Our automated tests run the safety checks on your pull request.</li>
            <li>We review the toy by hand, and we make its screenshot tests if you could not.</li>
            <li>
              Once we merge it, it shows in the gallery with "by Your Name" from the author in its item.json. Anyone can add it with{" "}
              <code className="inline">{addCommand("spinning-top")}</code>.
            </li>
          </ol>
          <p className="submit-note">
            The full rules are in <a href={CONTRIBUTING}>CONTRIBUTING</a>. The source is on{" "}
            <a href={REPO} target="_blank" rel="noreferrer">
              GitHub
            </a>
            .
          </p>
        </section>
      </div>
    </>
  );
}
