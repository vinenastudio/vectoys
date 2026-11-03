import type { ReactNode } from "react";
import { Footer } from "./components/footer";
import { Header } from "./components/header";
import type { Page } from "./pages";
import type { RegistryIndex } from "./registry";
import { Faq } from "./sections/faq";
import { Hero } from "./sections/hero";
import { JustSvg } from "./sections/just-svg";
import { MakeYourOwn } from "./sections/make-your-own";
import { Showcase } from "./sections/showcase";
import { Submit } from "./sections/submit";
import { Toys } from "./sections/toys";
import { Trick } from "./sections/trick";
import { Typing } from "./sections/typing";
import { Uses } from "./sections/uses";


/** What each page shows inside <main>. A page in PAGES without an entry here fails the typecheck. */
const CONTENT: Record<Page, (index: RegistryIndex | null) => ReactNode> = {
  home: (index) => (
    <>
      <Hero />
      <div className="sections">
        <JustSvg />
        <Trick />
        <Typing />
        <Uses index={index} />
        <Showcase />
        <MakeYourOwn />
        <Faq />
      </div>
    </>
  ),
  toys: (index) => <Toys index={index} />,
  submit: () => <Submit />,
};

export function App({ index, page }: { index: RegistryIndex | null; page: Page }) {
  return (
    <>
      <Header page={page} />
      <main>{CONTENT[page](index)}</main>
      <Footer />
    </>
  );
}
