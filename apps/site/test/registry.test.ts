import { expect, test } from "bun:test";
import { AUTHOR } from "@vectoys/registry-build/names";
import { makerOf, parseAuthor } from "../src/registry";

test("an author reads as a name and an optional web link", () => {
  expect(parseAuthor("Jane Doe (https://jane.example)")).toEqual({ name: "Jane Doe", url: "https://jane.example" });
  expect(parseAuthor("  Jane (http://jane.example/toys)  ")).toEqual({ name: "Jane", url: "http://jane.example/toys" });
  expect(parseAuthor("Jane Doe")).toEqual({ name: "Jane Doe" });
  expect(parseAuthor("Jane (jane@example.com)")).toEqual({ name: "Jane" });
  expect(parseAuthor("Jane (javascript:alert(1))")).toEqual({ name: "Jane (javascript:alert(1))" });
  expect(parseAuthor("Jane (javascript:alert)")).toEqual({ name: "Jane" });
  expect(parseAuthor("(https://jane.example)")).toBeNull();
  expect(parseAuthor("   ")).toBeNull();
});

test("cards credit outside makers only", () => {
  const item = { name: "ball", title: "Ball", description: "A ball.", license: "MIT" };
  expect(makerOf(item)).toBeNull();
  expect(makerOf({ ...item, author: AUTHOR })).toBeNull();
  expect(makerOf({ ...item, ...JSON.parse('{ "author": 42 }') })).toBeNull();
  expect(makerOf({ ...item, author: "Jane Doe (https://jane.example)" })).toEqual({ name: "Jane Doe", url: "https://jane.example" });
});
