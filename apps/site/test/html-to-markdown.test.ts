import { describe, expect, test } from "bun:test";
import { htmlToMarkdown } from "../scripts/html-to-markdown";

const md = (html: string) => htmlToMarkdown(html, { base: "https://vectoys.com" });

describe("htmlToMarkdown", () => {
  test("writes headings and paragraphs, with whitespace squashed and entities decoded", () => {
    expect(md("<h1>Submit a toy</h1><p>Make it,\n   check it &amp; send it &quot;in&quot;&#x27;s</p><h3>Next</h3>")).toBe(
      "# Submit a toy\n\nMake it, check it & send it \"in\"'s\n\n### Next\n",
    );
  });

  test("makes links absolute and keeps inline code, bold and italics", () => {
    expect(md('<p>Read <a href="/submit">the steps</a>, run <code>vectoys check .</code>, <strong>then</strong> <em>wait</em>. <a href="https://github.com/x">GitHub</a></p>')).toBe(
      "Read [the steps](https://vectoys.com/submit), run `vectoys check .`, **then** _wait_. [GitHub](https://github.com/x)\n",
    );
  });

  test("writes bullet and numbered lists, and indents blocks inside an item", () => {
    expect(md("<ul><li>One</li><li>Two</li></ul>")).toBe("- One\n- Two\n");
    expect(md('<ol><li><p>Make it.</p><div class="command"><code>npx make</code></div></li><li><p>Send it.</p></li></ol>')).toBe(
      "1. Make it.\n\n   ```\n   npx make\n   ```\n\n2. Send it.\n",
    );
  });

  test("writes a lone code element as a block of code, without its hidden prompt sign or its copy button", () => {
    const command = '<div class="command"><code><span class="command-prompt" aria-hidden="true">$ </span>npx @vinena/vectoys-cli add phone</code><button aria-label="Copy"><svg><path d="M0 0"/></svg></button><span class="visually-hidden" aria-live="polite">Copied</span></div>';
    expect(md(command)).toBe("```\nnpx @vinena/vectoys-cli add phone\n```\n");
  });

  test("writes a figure with a caption as the caption and a block of its text", () => {
    expect(md('<figure class="prompt"><figcaption>Prompt for your agent</figcaption><p>Read the prompt and follow it.</p><button>Copy</button></figure>')).toBe(
      "Prompt for your agent:\n\n```\nRead the prompt and follow it.\n```\n",
    );
  });

  test("drops SVG, scripts, buttons, form fields, images, hidden parts and data-llms skip", () => {
    const html = [
      "<p>Kept</p>",
      '<svg viewBox="0 0 10 10"><text>In the drawing</text><path d="M1 1"/></svg>',
      '<script>const html = "<p>In a script</p>";</script>',
      "<button>Show paths</button>",
      '<input value="typed"/><img alt="A picture" src="/a.png"/>',
      '<p aria-hidden="true">Hidden from readers</p>',
      "<p hidden>Hidden</p>",
      '<span class="visually-hidden">Copied</span>',
      '<div data-llms="skip"><ul><li>Buy oat milk</li></ul></div>',
      "<!-- a comment -->",
      "<p>Also kept</p>",
    ].join("");
    expect(md(html)).toBe("Kept\n\nAlso kept\n");
  });

  test("keeps a button that is a heading's text, as a question that opens its answer", () => {
    expect(md('<h3><button aria-expanded="false">Is it free?<svg><path d="M0 0"/></svg></button></h3><div inert=""><p>Yes.</p></div>')).toBe("### Is it free?\n\nYes.\n");
  });

  test("keeps the words of blocks inside a link apart", () => {
    expect(md('<ul><li><a href="https://snug.so"><div><h3>Snug</h3><p>A Mac app</p></div></a></li></ul>')).toBe("- [Snug: A Mac app](https://snug.so/)\n");
  });

  test("turns loose text between blocks into paragraphs", () => {
    expect(md("<div>Loose <code>text</code><p>A paragraph</p>after</div>")).toBe("Loose `text`\n\nA paragraph\n\nafter\n");
  });

  test("reads only the first element named by within", () => {
    const html = "<header><p>Menu</p></header><main><h1>Title</h1></main><footer><p>Footer</p></footer>";
    expect(htmlToMarkdown(html, { base: "https://vectoys.com", within: "main" })).toBe("# Title\n");
    expect(() => htmlToMarkdown("<p>No main</p>", { base: "https://vectoys.com", within: "main" })).toThrow("no <main>");
  });
});
