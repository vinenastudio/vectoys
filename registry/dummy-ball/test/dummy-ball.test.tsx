import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DummyBall } from "../src";

test("renders on the server as a labelled image with no NaN", () => {
  const html = renderToStaticMarkup(<DummyBall label="A blue ball" finish="#3b82f6" />);
  expect(html).toStartWith('<div role="img" aria-label="A blue ball"');
  expect(html).toContain("fill:#3b82f6");
  expect(html).not.toContain("NaN");
});
