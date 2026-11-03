/** What a page is called, where it is, and the head it gets. `description` takes the number of items the registry lists. */
type PageInfo = { page: string; path: string; slug: string; name: string; title: string; description: (items: number) => string };

/**
 * Every page of the site, in the order llms.txt and the sitemap list them. The
 * prerender writes each to `<slug>.html` and `<slug>.md`. A new page goes here
 * and nowhere else.
 */
export const PAGES = [
  {
    page: "home",
    path: "/",
    slug: "index",
    name: "Home",
    title: "vectoys: open source SVG 3D engine for device mockups",
    description: () => "An open source SVG 3D engine for device mockups and small 3D toys on landing pages. Plain SVG paths, live HTML on the screens, no WebGL.",
  },
  {
    page: "toys",
    path: "/toys",
    slug: "toys",
    name: "All toys",
    title: "All toys: SVG 3D devices and toys for React | vectoys",
    description: (items) => `All ${items} vectoys devices and toys, live in the browser, each with its install command, its source and its shadcn registry address.`,
  },
  {
    page: "submit",
    path: "/submit",
    slug: "submit",
    name: "Submit a toy",
    title: "Submit a toy | vectoys",
    description: () => "Give your agent one prompt, or run three commands, to make a vectoys toy, check it and send it in. We review every toy and credit you.",
  },
] as const satisfies readonly PageInfo[];

/** The site's pages, by name. */
export type Page = (typeof PAGES)[number]["page"];

export function pageFor(pathname: string): Page {
  const path = pathname.replace(/\/+$/, "") || "/";
  return PAGES.find((info) => info.path === path)?.page ?? "home";
}
