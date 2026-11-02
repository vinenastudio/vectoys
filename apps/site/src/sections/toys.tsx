import { CopyCommand } from "../components/copy-command";
import { LazyPreview } from "../components/lazy-preview";
import { previewFor } from "../items";
import { REPO, addCommand, makerOf, type Entry, type RegistryIndex } from "../registry";
import { useItems } from "../use-items";

function Toy({ item }: { item: Entry }) {
  const Preview = previewFor(item.name);
  const maker = makerOf(item);
  return (
    <li className="toy" id={item.name}>
      <LazyPreview className="toy-preview">{() => <Preview />}</LazyPreview>
      <div className="use-text">
        <h2>{item.title}</h2>
        <p>{item.description}</p>
        {maker && (
          <p className="toy-maker">
            by{" "}
            {maker.url ? (
              <a href={maker.url} target="_blank" rel="noopener noreferrer nofollow ugc">
                {maker.name}
              </a>
            ) : (
              maker.name
            )}
          </p>
        )}
      </div>
      <CopyCommand command={addCommand(item.name)} className="command-in-card" />
      <a className="toy-source" href={`${REPO}/tree/main/registry/${item.name}`} target="_blank" rel="noreferrer">
        Source on GitHub
      </a>
    </li>
  );
}

/** The /toys page: every item the registry lists, live, with its install command and its source. */
export function Toys({ index }: { index: RegistryIndex | null }) {
  const items = useItems(index);
  return (
    <>
      <section className="hero" aria-labelledby="toys-title">
        <div className="toys-intro">
          <h1 id="toys-title">All toys</h1>
          <p className="lede">
            {items && items.length > 0 ? `${items.length} devices and toys` : "Every device and toy"}, each one live. Copy one into your React
            project with its command, then change it as you like.
          </p>
        </div>
      </section>
      <div className="sections">
        {items && items.length === 0 ? (
          <p className="empty">The registry could not be read. Reload the page to try again.</p>
        ) : (
          <ul className="toys">{items?.map((item) => <Toy key={item.name} item={item} />)}</ul>
        )}
      </div>
    </>
  );
}
