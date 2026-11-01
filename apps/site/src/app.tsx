import { Footer } from "./components/footer";
import { Header } from "./components/header";
import type { RegistryIndex } from "./registry";
import { Faq } from "./sections/faq";
import { Hero } from "./sections/hero";
import { JustSvg } from "./sections/just-svg";
import { MakeYourOwn } from "./sections/make-your-own";
import { Scrub } from "./sections/scrub";
import { Showcase } from "./sections/showcase";
import { Toys } from "./sections/toys";
import { Trick } from "./sections/trick";
import { Typing } from "./sections/typing";
import { Uses } from "./sections/uses";

/** The site's pages, by path. */
export type Page = "home" | "toys";

export const pageFor = (pathname: string): Page => (pathname.replace(/\/+$/, "") === "/toys" ? "toys" : "home");

export function App({ index, page }: { index: RegistryIndex | null; page: Page }) {
  return (
    <>
      <Header />
      <main>
        {page === "toys" ? (
          <Toys index={index} />
        ) : (
          <>
            <Hero />
            <div className="sections">
              <JustSvg />
              <Trick />
              <Scrub />
              <Typing />
              <Uses index={index} />
              <Showcase />
              <MakeYourOwn />
              <Faq />
            </div>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
