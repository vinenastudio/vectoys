import { CopyCommand, CopyPrompt } from "../components/copy-command";
import { REPO, addCommand } from "../registry";
import { PROMPT } from "./make-your-own";

const CONTRIBUTING = `${REPO}/blob/main/CONTRIBUTING.md`;

const QUALITY = [
  "It is a generic object, with no product, logo or brand name.",
  "It looks right in light and dark mode.",
  "It respects reduced motion.",
  "It works with a keyboard and a screen reader.",
  "It renders on the server.",
  "It stays small, under 96 kilobytes.",
  "It turns when dragged and fills the screen. The create command sets this up.",
];

/** The /submit page: what a good toy is, the three commands that send one in, and what happens after. */
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
        <section className="submit-part" aria-labelledby="submit-quality">
          <h2 id="submit-quality">What makes a good toy</h2>
          <ul className="submit-list">
            {QUALITY.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <section className="submit-part" aria-labelledby="submit-steps">
          <h2 id="submit-steps">Make, check and submit</h2>
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
          <p className="submit-note">Or give this prompt to your coding agent and it does all three steps for you.</p>
          <CopyPrompt prompt={PROMPT} caption="Prompt to make your own toy" placement="submit" />
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
