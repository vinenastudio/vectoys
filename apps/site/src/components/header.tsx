import type { Page } from "../app";
import { REPO, REPO_PUBLIC } from "../registry";
import { GitHubMark } from "./icons";

export function Header({ page }: { page: Page }) {
  return (
    <header className="site-header">
      <a href="/" className="wordmark">
        vectoys
      </a>
      <nav className="site-nav" aria-label="Sections">
        <a href="/toys">Gallery</a>
        <a href="/#registry" className="nav-registry">
          Registry
        </a>
        <a href="/#showcase" className="nav-showcase">
          Showcase
        </a>
      </nav>
      <a
        href="/submit"
        className="button-filled header-submit"
        aria-current={page === "submit" ? "page" : undefined}
        data-track="submit_click"
        data-placement="header"
      >
        Submit<span className="submit-label-end"> a toy</span>
      </a>
      {REPO_PUBLIC && (
        <a href={REPO} target="_blank" rel="noreferrer" className="github-button">
          <GitHubMark /> <span className="github-label">GitHub</span>
        </a>
      )}
    </header>
  );
}
