import { MailIcon } from "../components/icons";

const TITLE = "What people say";

/** Press quotes about vectoys, one card each. */
const QUOTES = [
  {
    quote:
      "Vectoys is a set of React components that render phones, laptops and other small 3D objects as SVG, with interactive HTML inside their screens. Could be handy for mockups or 'in-situ' teasers on your homepage.",
    name: "React Status",
    detail: "Issue 497, November 13, 2026",
    url: "https://react.statuscode.com/issues/497",
    host: "react.statuscode.com",
  },
];

export function Praise() {
  return (
    <section className="section" id="praise" aria-labelledby="praise-title">
      <div className="section-copy section-copy-wide">
        <h2 id="praise-title">{TITLE}</h2>
      </div>
      <ul className="praise">
        {QUOTES.map((item) => (
          <li key={item.url}>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="praise-card"
              data-track="outbound_click"
              data-to={item.host}
              data-placement="praise"
            >
              <blockquote cite={item.url}>
                <p>{item.quote}</p>
              </blockquote>
              <div className="praise-source">
                <span className="praise-icon">
                  <MailIcon />
                </span>
                <span className="praise-name">
                  {item.name}{" "}
                  <span className="praise-detail">{item.detail}</span>
                </span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
