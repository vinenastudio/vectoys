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


export function App({ index, page }: { index: RegistryIndex | null; page: Page }) {
  return (
    <>
      <Header page={page} />
      <main>
        {page === "toys" ? (
          <Toys index={index} />
        ) : page === "submit" ? (
          <Submit />
        ) : (
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
        )}
      </main>
      <Footer />
    </>
  );
}
