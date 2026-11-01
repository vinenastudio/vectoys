import { CopyPrompt } from "../components/copy-command";

const PROMPT = "Run npx @vinena/vectoys-cli skill and follow it. Make me a spinning top for my landing page, check it, preview it, then submit it.";

export function MakeYourOwn() {
  return (
    <section className="section split" id="make-your-own" aria-labelledby="make-your-own-title">
      <div className="section-copy">
        <h2 id="make-your-own-title">Make your own with your agent</h2>
        <p>The CLI comes with a skill that teaches a coding agent how items are built. Give it this prompt and it creates, checks, previews and submits the item for you.</p>
      </div>
      <CopyPrompt prompt={PROMPT} caption="Prompt to make your own toy" placement="make-your-own" />
    </section>
  );
}
