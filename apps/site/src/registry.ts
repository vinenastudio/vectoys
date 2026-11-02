import { AUTHOR } from "@vectoys/registry-build/names";

/** One item as `/r/index.json` lists it; `author` is its maker as "Name (url)". */
export type Entry = { name: string; title: string; description: string; license: string; author?: string; credit?: string };

/** What `/r/index.json` holds. */
export type RegistryIndex = { name: string; homepage: string; items: Entry[] };

/** The id of the script tag the prerendered page carries the index in, so hydration draws the same gallery. */
export const INDEX_DATA = "registry-index";

export const REPO = "https://github.com/vinenastudio/vectoys";

/** Whether the repo is public, so the site shows its GitHub links. */
export const REPO_PUBLIC = true;

export const addCommand = (name: string) => `npx @vinena/vectoys-cli add ${name}`;

export type Maker = { name: string; url?: string };

/** An author written "Name (url)" as a name and, when the url is http or https, a link. */
export function parseAuthor(author: string): Maker | null {
  const match = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(author.trim());
  const name = (match ? match[1] : author)?.trim();
  if (!name) return null;
  const url = match?.[2]?.trim();
  return url && isWebUrl(url) ? { name, url } : { name };
}

function isWebUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** The maker a gallery card credits: none for our own items, or when the index holds no text for one. */
export function makerOf(entry: Entry): Maker | null {
  const author: unknown = entry.author;
  return typeof author === "string" && author !== AUTHOR ? parseAuthor(author) : null;
}
