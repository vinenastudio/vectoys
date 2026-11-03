import { CopyPrompt } from "../components/copy-command";

export const PROMPT = "Run npx @vinena/vectoys-cli skill and follow it. Make me a spinning top for my landing page, check it, preview it, then submit it.";

export function MakeYourOwn() {
  return (
    <section className="section split" id="make-your-own" aria-labelledby="make-your-own-title">
      <div className="section-copy">
        <h2 id="make-your-own-title">Make your own with your agent</h2>
        <p>The CLI comes with a skill that teaches a coding agent how items are built. Give it this prompt and it creates, checks, previews and submits the item for you.</p>
        <p>
          Submissions are open. <code>npx @vinena/vectoys-cli submit {"<dir>"}</code> opens a pull request, or open one by hand as{" "}
          <a href="https://github.com/vinenastudio/vectoys/blob/main/CONTRIBUTING.md">CONTRIBUTING</a> says. We review every toy before it goes in the gallery.
        </p>
      </div>
      <CopyPrompt prompt={PROMPT} caption="Prompt to make your own toy" placement="make-your-own" />
    </section>
  );
}
