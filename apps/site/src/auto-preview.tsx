import { Component, Suspense, lazy, type ComponentType, type ReactNode } from "react";
import { Placeholder } from "./previews/placeholder";

/** Loads an item's `src/index.ts`. */
export type Loader = () => Promise<Record<string, unknown>>;

const isComponent = (value: unknown): value is ComponentType =>
  typeof value === "function" || (typeof value === "object" && value !== null && "$$typeof" in value);

/** `my-toy` as the component an item exports, `MyToy`. */
const componentName = (name: string) =>
  name
    .split(/[^a-zA-Z0-9]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

/** What a gallery card draws for an item: its `Demo`, else its main component or default export with no props. */
export function pickPreview(module: Record<string, unknown>, name: string): ComponentType | null {
  for (const key of ["Demo", componentName(name), "default"]) {
    const value = module[key];
    if (isComponent(value)) return value;
  }
  return null;
}

/** Shows the placeholder when a preview fails to load or draw, so one broken item leaves the gallery whole. */
class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? <Placeholder /> : this.props.children;
  }
}

const made = new Map<string, ComponentType>();

/** A preview that loads the item's module only when drawn, then shows what `pickPreview` finds there. */
export function autoPreview(name: string, load: Loader): ComponentType {
  const known = made.get(name);
  if (known) return known;
  const Loaded = lazy(async () => {
    const Item = pickPreview(await load(), name);
    if (!Item) return { default: Placeholder };
    return {
      default: () => (
        <div className="preview-toy">
          <Item />
        </div>
      ),
    };
  });
  const Preview = () => (
    <PreviewBoundary>
      <Suspense fallback={null}>
        <Loaded />
      </Suspense>
    </PreviewBoundary>
  );
  made.set(name, Preview);
  return Preview;
}
