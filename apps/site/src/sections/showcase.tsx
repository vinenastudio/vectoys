import { useEffect, useRef } from "react";
import { ArrowUpRightIcon } from "../components/icons";

/** Our own products that draw their hero scenes with vectoys. Product names stay in this section only. */
const PRODUCTS = [
  {
    name: "Snug",
    host: "snug.so",
    clip: "snug",
    line: "vectoys draws the MacBook that kickflips into the scroll scene",
  },
  {
    name: "Agent Caffeine",
    host: "caffeinagent.com",
    clip: "caffeinagent",
    line: "vectoys draws the Mac and its menu bar in the hero",
  },
  {
    name: "Wax",
    host: "waxmac.com",
    clip: "wax",
    line: "vectoys draws the iPhone and the MacBook with its cable in the hero",
  },
];

const SCHEMES = ["light", "dark"] as const;

const linkTo = (host: string) => `https://${host}/?utm_source=vectoys.com&utm_medium=referral&utm_campaign=showcase`;

/**
 * A real capture of a product's hero, one clip per color scheme; the page's
 * scheme shows one of them. The shown clip loads once it comes near the
 * screen, with its poster, and plays while it is in view. With reduced motion
 * it never plays, so the poster, the loop's first frame, stays.
 */
function Clip({ clip }: { clip: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = box.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const dark = matchMedia("(prefers-color-scheme: dark)");
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    let near = false;
    let seen = false;
    const update = () => {
      const shown = dark.matches ? "dark" : "light";
      for (const video of element.querySelectorAll("video")) {
        const mine = video.dataset.scheme === shown && !still.matches;
        if (video.dataset.scheme === shown && near) video.poster = `/showcase/${clip}-${shown}.webp`;
        if (mine && near) video.preload = "auto";
        if (mine && seen) {
          video.muted = true;
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      }
    };
    const nearby = new IntersectionObserver(
      ([entry]) => {
        near = entry?.isIntersecting ?? false;
        update();
      },
      { rootMargin: "400px 0px" },
    );
    const inView = new IntersectionObserver(
      ([entry]) => {
        seen = entry?.isIntersecting ?? false;
        update();
      },
      { threshold: 0.25 },
    );
    nearby.observe(element);
    inView.observe(element);
    dark.addEventListener("change", update);
    still.addEventListener("change", update);
    return () => {
      nearby.disconnect();
      inView.disconnect();
      dark.removeEventListener("change", update);
      still.removeEventListener("change", update);
    };
  }, [clip]);
  return (
    <div className="showcase-clip" ref={box} aria-hidden="true" data-replay-block="">
      {SCHEMES.map((scheme) => (
        <video
          key={scheme}
          className={`showcase-video showcase-video-${scheme}`}
          data-scheme={scheme}
          width={1280}
          height={800}
          muted
          loop
          playsInline
          preload="none"
          disablePictureInPicture
        >
          <source src={`/showcase/${clip}-${scheme}.webm`} type="video/webm" />
          <source src={`/showcase/${clip}-${scheme}.mp4`} type="video/mp4" />
        </video>
      ))}
    </div>
  );
}

export function Showcase() {
  return (
    <section className="section" id="showcase" aria-labelledby="showcase-title">
      <div className="section-copy section-copy-wide">
        <h2 id="showcase-title">Used in production</h2>
        <p>Our own Mac apps draw the devices in their landing page heroes with vectoys.</p>
      </div>
      <ul className="showcase">
        {PRODUCTS.map((product) => (
          <li key={product.host}>
            <a
              href={linkTo(product.host)}
              target="_blank"
              rel="noreferrer"
              className="showcase-card"
              data-track="outbound_click"
              data-to={product.host}
              data-placement="showcase"
            >
              <Clip clip={product.clip} />
              <div className="showcase-text">
                <h3>
                  {product.name}
                  <ArrowUpRightIcon />
                </h3>
                <p>{product.line}</p>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
