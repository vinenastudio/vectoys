import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { E2eTop } from "../src";

test("renders on the server as a labelled image that turns, with no NaN", () => {
  const html = renderToStaticMarkup(<E2eTop label="A blue slab" finish="#3b82f6" />);
  expect(html).toContain('<div class="vectoys-turntable"');
  expect(html).toContain('<div role="img" aria-label="A blue slab"');
  expect(html).toContain("--vectoys-finish:#3b82f6");
  expect(html).not.toContain("NaN");
});
