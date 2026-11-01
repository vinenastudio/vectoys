# vectoys

Vector toys: 3D devices and playful scenes for the web, drawn as SVG.

An SVG 3D engine for device mockups (laptops, phones, tablets) and small playful 3D toys on landing pages. Everything is projected to plain SVG paths, so the markup renders on the server, stays crisp at any size, and needs no WebGL.

Status: early.

## Packages

- `packages/engine` (`@vinena/vectoys`): a perspective camera, 3D rotations and poses, 2D outline helpers and compact SVG path output. Zero runtime dependencies.
- `packages/react` (`@vinena/vectoys-react`): `Stage`, `Faces` and `Screen`, the React pieces any item draws with, and the motion hooks `useSpring`, `useFrames`, `useReducedMotion` and `useScrub`. MIT.
- `packages/cli` (`@vinena/vectoys-cli`, command `vectoys`): the CLI that copies items into a project. MIT.
- `packages/registry-build`: writes the registry JSON the site serves at `/r`.
- `apps/site`: vectoys.com, the landing page and the gallery, which also serves the registry at `/r`.

### Engine

Besides the camera, poses and paths, the engine has:

- `slab({ taper })`: the top's outline stands in from the bottom's by `taper` on every side, so the sides lean in as a keycap's do.
- `slab({ outline })` and `plate({ outline })`: a part takes any flat outline in place of its rounded box, such as a triangle for an envelope's flap.
- `rotateAxis(axis, degrees)`: a turn about any axis.
- `slerp(from, to, share)`: the rotation a share of the way between two, turning the short way round.
- `spring(state, target, seconds, { stiffness, damping })` and `settled(state, target)`: a value on a spring, stepped in small fixed steps so any frame rate gives the same path. `useSpring(target)` in `@vinena/vectoys-react` follows a target on it.
- `clamp(v, lo, hi)`, `lerp(a, b, t)` and `ease(t)`, which eases a share from 0 to 1 in and out. `segment(p, i, n)` is how far a progress `p` is through segment `i` of `n` equal ones, from 0 to 1.
- `scrub(t, keys, { ease })`: every number the keyframes set, at progress `t`. Keys are sorted by `at`, such as `[{ at: 0, lid: 0, yaw: 0 }, { at: 0.12, lid: 1 }, { at: 0.3, yaw: -20 }]`. Each segment between two keys eases on its own, with `ease` unless you pass another. A key that leaves a field out keeps the value from the key before, and before a field's first key it holds that first value.
- Eases for a share from 0 to 1: `backIn` draws back below 0 before it goes, `backOut` shoots past 1 and comes back, `backInOut` does both, and `settle` falls to 1 and bounces up a little a few times, lower each time, without passing 1, so it lands like a dropped ball. `cubicBezier(x1, y1, x2, y2)` returns the ease CSS writes as `cubic-bezier(...)`. A key in `scrub` may carry its own `ease`, which shapes the segment that ends at that key: a name from `EASES` (`linear`, `ease`, `backIn`, `backOut`, `backInOut`, `settle`), any function, or a cubic Bézier's four numbers, such as `{ at: 0.6, y: 0, ease: "settle" }`. A key without one takes the `ease` you pass to `scrub`.

### Scroll scenes

`useScrub(ref, { screens })` in `@vinena/vectoys-react` follows a tall track element as the page scrolls, for a scene pinned inside it with `position: sticky`. The track is `screens` times the viewport's height, set by your CSS. It returns `{ progress, reduced }`. `progress.get()` is 0 while the track's top is at the viewport's top, and 1 once its bottom reaches the viewport's bottom. `progress.subscribe(fn)` calls `fn` with each new value, at most once a frame, and causes no React render. It does not call `fn` with the current value, so draw that first, for a page opened partway down. On the server `progress` is 0. `reduced` is true when the page asks for less motion, so you can show still frames with no pinning instead.

```tsx
const { progress } = useScrub(track, { screens: 4 });
useEffect(() => {
  const draw = (t: number) => laptop.current?.set(scrub(t, KEYS));
  draw(progress.get());
  return progress.subscribe(draw);
}, [progress]);
```

`placeScreen(element, camera, pose, rect)` lays a `Screen`'s element, which its `ref` gives you, onto a new pose without a render.

## Registry

Items to copy into a project, each described by its `item.json`. Every item is MIT licensed.

Devices:

- `registry/laptop`: a 14 inch laptop with a lid that opens and closes and live HTML on its display.
  `<Laptop eye={FRONT}>` shows it straight on, as a product shot drawn flat to sizes measured on product renders: the open lid with its notch, over the base's front face with the thumb's scoop and two feet. The lid is always open there, and its aluminum takes `--vectoys-finish`, silver by default (`#3d3b3e` reads as space black). The scene is the laptop's own bounds. Laptop takes no style or className, so to let a frame cut it, put it in a div with `width: 121.4%; margin-inline: -10.7%; margin-bottom: -3%` inside a wrapper with `overflow: hidden`. The lid then fills the wrapper's width, the base's ends are cut flush with the lid's sides, and the base's face just under the thumb's scoop.
  `<Laptop eye={DESK} lid={1} yaw={-20} pitch={15}>` turns the laptop in perspective, from either `DESK` or `PHONE`. `lid` runs from 0 (shut) to 1 (open), and `closed`, its opposite, still works but is deprecated; `lid` wins when you pass both. `yaw` turns the laptop about its own upright axis, from -35 to 35 degrees; positive turns the display toward the page's right. `pitch` is the eye's height in degrees, from 5 to 30, 15 for `DESK` and 12 for `PHONE` by default. With none of these, the laptop draws exactly as before. `turning` draws in a fixed box that holds every pose, `LAPTOP_BOX[eye.id]` (`{ width, height }` in scene units), so the stage keeps one size while the laptop opens and turns. Pass `ref` for a `LaptopHandle`: `ref.current.set({ lid, yaw, pitch })` moves the laptop at once with no React render, changing only the fields you pass. That fits a pose that changes every frame, such as one driven by the scroll. The handle owns the pose from its first `set` until a `lid`, `closed`, `yaw` or `pitch` prop changes, and then the props win. Renders for anything else, such as new content on the display, keep the handle's pose.
  `<Laptop eye={DESK} free flat={1}>` lets the laptop turn any way and leave its box, for a trick. `free` lifts the ranges on `yaw`, `pitch` and `roll`, and the drawing may go past the stage, so size the box round where it lands. `flat` runs from 0, the eye's own look, to 1, FRONT's straight-on shot: open and with every angle 0, it draws as `<Laptop eye={FRONT}>` does, FRONT's scene across the eye's own scene from its top, silver from the page's `--vectoys-finish`. Between the two, the camera, the shapes and the tones ease from one to the other in any pose. `x` and `y` move the drawing on screen in shares of the laptop's width, `WIDTH`, with `y` up: `y` is the height over the ground, so the shadow stays on the ground and fades and spreads as the laptop goes up. `scale` grows it about its middle, 1 at rest. `roll` turns it about its long axis, from left to right, in degrees; positive lifts its front. With `free` or any of these, the laptop is a closed slab from every side, with its underside, feet, back and the lid's outer face, and the live glass hides whenever the display faces away or is seen from under the deck. Every one of these fields works as a prop and in `ref.current.set({ ... })`, and the handle holds them as it holds the others. `KICKFLIP` is a keyframe preset for `scrub`: the lid shuts straight on, the laptop comes down, crouches, pops into a kickflip with a shove-it, hangs, lands with a small bounce in perspective and opens. Play it with `laptop.current?.set(scrub(t, KICKFLIP))`. It starts 0.6 of the laptop's width up and leaves `pitch` to the laptop.
- `registry/laptop-front`: the same laptop straight on as its own item, `<LaptopFront>`, with live HTML on its display and `finish="silver"` or `finish="black"` for space black.
- `registry/phone`: a modern flagship phone that turns any way, with side buttons, a camera bump and live HTML on its display.
- `registry/tablet`: an 11 inch tablet that turns any way, upright or on its side, with live HTML on its display.
- `registry/monitor`: a 27 inch monitor on a stand that turns any way, its panel tilting on the stand, with live HTML on its display.
- `registry/browser`: a browser window that floats and turns any way, stacks with others, and shows an address and live HTML in light or dark tones.
- `registry/watch`: a smartwatch that turns any way, with a crown, a side button, a bent band and live HTML on its display.

Toys:

- `registry/keycap`: a keycap that is a real button, with a live label on its dished top; it lifts on hover and travels down when pressed, and `KeycapRow` spells a word; it can click as it goes down and up, with a switch to turn the sound on and off.
- `registry/keyboard`: a full-size keyboard with a US layout whose keys go down as you type on your own keyboard while it is on screen, each with a soft click, and a button that turns the sound off. It can show a text box that catches what you type and a button that fills the screen.
- `registry/envelope`: a newsletter envelope that opens on a click, its flap swinging up and a letter with live content rising out.
- `registry/floppy`: a floppy disk that is a download link or a button; its shutter slides open and it turns toward the eye on hover.
- `registry/card`: a flip card with live HTML on both faces that flips on a click or a hover and leans toward the pointer.
- `registry/dice`: a die that rolls when clicked, tumbles and lands on a random or given face.
- `registry/gift`: a gift box whose lid pops off on a click, with live HTML such as a coupon code rising out.

## Install an item

Items are copied into your project as source, so you can change them. The engine and the React pieces come as normal packages. Items need React 19 or later.

```sh
npx @vinena/vectoys-cli add laptop
```

This writes `vectoys.json`, copies the item to `src/components/vectoys/laptop/` (or `components/vectoys/` without a `src` folder), and installs `@vinena/vectoys` and `@vinena/vectoys-react` with your package manager. `npx @vinena/vectoys-cli list` shows every item.

The CLI finds your package manager in your project or in the workspace above it: the `packageManager` field first, then the lockfile. In a monorepo it installs in the app folder you run it from. If your tsconfig.json uses `node16` or `nodenext` module resolution, the CLI adds `.js` to the relative imports in the copied files (or `.ts` and `.tsx` with `allowImportingTsExtensions`). Bundler projects get the files unchanged.

The shadcn CLI works too:

```sh
npx shadcn add https://vectoys.com/r/laptop.json
```

Items from other registries go by scope once the scope is in `vectoys.json`:

```json
{ "registries": { "@acme": "https://acme.dev/r" } }
```

```sh
npx @vinena/vectoys-cli add @acme/thing
npx @vinena/vectoys-cli add https://acme.dev/r/thing.json
```

### Make a new item

Start a new item, draw it with your own coding agent, and check it before you submit it:

```sh
npx @vinena/vectoys-cli create spinning-top --dir registry
npx @vinena/vectoys-cli check registry/spinning-top
npx @vinena/vectoys-cli preview registry/spinning-top --open
npx @vinena/vectoys-cli submit registry/spinning-top
```

`npx @vinena/vectoys-cli skill` prints how a coding agent makes an item, so you can point your agent at it.

`create` writes `spinning-top/` (under `--dir`, else the current folder) with an `item.json`, a working component that draws a tilted, shaded slab, a `package.json`, a `tsconfig.json` and a test, as the items in `registry/` have. It does not write over a folder that is already there unless you pass `--overwrite`. Made in `registry/` of this repository, `bun install` links its packages. Made anywhere else, it asks for `@vinena/vectoys` and `@vinena/vectoys-react` from npm by version, and writes a `tsconfig.json` of its own; `submit` turns both back into the form the items in `registry/` have.

`check` prints a pass or fail line for each check and exits with 1 if any fails. It checks that `item.json` has what the registry needs, that the files are under 96 KB together, that the component renders on the server twice to the same markup with no `NaN` or `Infinity` in it, that its root is `role="img"` with an `aria-label` or its controls are labelled, and that neither `item.json` nor the rendered text names a brand or a device maker. It loads the component with [bun](https://bun.sh), so `check` needs bun, and the item's packages installed.

`preview` renders the item the same way into `preview.html` in its folder, in light and dark side by side, and prints the file's path; `--open` opens it. If the component takes a `yaw`, it also shows it turned to -45, -20, 0, 20 and 45 degrees. `create` writes a `.gitignore` that leaves `preview.html` out.

`submit` runs `check` and stops if any check fails. Then, with the [GitHub CLI](https://cli.github.com), it forks this repository, copies the files `item.json` lists, its `package.json`, `tsconfig.json` and `test/` to `registry/<name>/` on a branch `item/<name>`, and opens a pull request that lists the check results. `submit --registry <url>` reads `<url>/index.json` (or the URL itself if it ends in `.json`), checks that it lists items, and opens a pull request that adds your registry to `registries.json`. Submissions open when vectoys launches: until then `submit` checks, says what it would send, and sends nothing. `--dry-run` does the same at any time.

### Host your own registry

Serve one JSON file per item at `<base>/<name>.json`, in the [shadcn registry-item format](https://ui.shadcn.com/docs/registry/registry-item-json) with each file's source in `content`, and an `index.json` at `<base>/index.json` that lists `{ "items": [{ "name", "title", "description" }] }`. Any static host works; `bun run registry:build` shows how this repo writes its own to `apps/site/public/r`.

## Shading

`draw` tells how much light falls on each face: every face it returns has a `normal` and a `shade` from the light's ambient share up to 1. The light is held still with the eye, not with the model, so as a device spins its sides brighten and darken as they turn. Pass `draw(scene, camera, { light: { direction, ambient } })` to move it; `direction` points toward the light in the scene's axes (x right, y down, z toward the eye).

`<Faces shading />` uses it: each face's fill is mixed a few steps darker in less light, and the few faces turned right at the light are lifted a little. Only fills that are colors are shaded, never `none` or a `url(...)` paint. Devices and toys drawn with `shading` are shaded. The page tunes it with CSS variables:

- `--vectoys-shade-strength`: how dark the faces in least light get, `0.5` by default, `0` for none.
- `--vectoys-shade-color`: the color mixed in, `black` by default.
- `--vectoys-highlight-strength`: how far faces toward the light are lifted, `0.25` by default.
- `--vectoys-highlight`: the color they are lifted toward, `white` by default.

## Colors

Every item reads its colors from CSS variables, so a page themes them all at once. Each falls back to a light tone when unset.

- `--vectoys-surface`: the main surface of a body or a part, `#f5f5f5`.
- `--vectoys-hairline`: the outlines and the darker edges, `#8a8a8a`.
- `--vectoys-shadow`: the shadow on the ground, `rgba(0, 0, 0, 0.08)`.
- `--vectoys-finish`: the color of a body: the back and stand of a device, a keycap, a keyboard's keys, a die, the card's back. By default the surface; the envelope's lining a shade under it, the floppy disk `#2c2c2e`, the gift box `#e5484d`, and the laptop seen from the front and the laptop-front item a silver `#f0f1f3` (`#3d3b3e` gives space black; the laptop-front item's `finish` prop sets it too).
- `--vectoys-accent`: the gift box's ribbon and bow, `#f5c84c`.
- `--vectoys-band`: the watch's band, a shade under the surface.
- `--vectoys-ink`: a keycap's label, a keyboard's legends, the die's pips and the browser's address, `#1d1d1c`.
- `--vectoys-bg`: the laptop's and the browser's page behind the content, `#ffffff`.
- `--vectoys-border`: the laptop's rim and trackpad outline, `#d4d4d4`.
- `--vectoys-paper`: the floppy disk's label, `#f7f6f1`.
- `--vectoys-paper-ink`: the text on that label, `#1d1d1c`.
- `--vectoys-focus`: the focus ring of the card, the die and the gift box, `currentColor`.
- `--vectoys-focus-width`: how thick that ring is, `1px`.

Under a dark color scheme the browser window, the keycap, the keyboard and the die fall back to dark tones instead: `--vectoys-surface` `#262626`, `--vectoys-hairline` `#5a5a5a`, `--vectoys-ink` `#ededed`, `--vectoys-shadow` `rgba(0, 0, 0, 0.4)`, and for the browser `--vectoys-bg` `#161616`. The browser also takes `theme="dark"`. The shading variables are below.

## Develop

```sh
bun install
bun run typecheck
bun run test
bun run dev
```

`bun run dev` builds the registry and serves the site at https://vectoys.localhost through portless. In dev the site loads `@vinena/knobs`: ⇧K opens the panel, ⇧G grabs an element for an agent. It never ships in the production build.

`bun run test` builds the packages first, since some CLI tests run items against the built `dist`.

Pushing to main deploys vectoys.com through GitHub Actions. The deploy then notifies IndexNow and Search Console of changed sitemap URLs through vinenastudio/deploy-indexing, so the IndexNow key file `apps/site/public/78542e187dcb354c241595d0ddb65792.txt` must stay.

## Release

1. Bump the version in `packages/engine`, `packages/react` and `packages/cli`. The three `package.json` files share one version. Then set the same version on the `packages/engine`, `packages/react` and `packages/cli` entries in `bun.lock` (plain `bun install` does not update them), and commit `bun.lock` with the bump. `bun pm pack` and `bun publish` take the engine version for the React package from `bun.lock`, so this applies to `bun run release` too. If you skip it, the Release workflow fails.
2. Merge the change to main.
3. Push a tag `vectoys@<version>`, for example `git tag vectoys@0.3.0 && git push origin vectoys@0.3.0`. The tag must point to a commit on main.

One-time setup: link each package to the workflow as a trusted publisher. This needs npm 11.15 or later and 2FA on your npm account.

```sh
npm trust github @vinena/vectoys --file release.yml --repo vinenastudio/vectoys --allow-publish
npm trust github @vinena/vectoys-react --file release.yml --repo vinenastudio/vectoys --allow-publish
npm trust github @vinena/vectoys-cli --file release.yml --repo vinenastudio/vectoys --allow-publish
```

npm removes a new trusted publisher if no publish happens through it within 2 days. So run these commands right before the first release from CI.

The Release workflow (`.github/workflows/release.yml`) checks that the tag matches all three versions, then typechecks, builds and tests. It publishes the engine, then the React package, then the CLI through npm trusted publishing, so it needs no npm token and npm adds provenance. A version with a `-` goes out under the `next` tag. A version that is already on npm is skipped, so you can run a failed release again.

`bun pm pack` makes each tarball, because it turns the `workspace:` ranges into real versions; `npm publish` alone would ship them as they are.

`bun run release` stays as the manual fallback. It builds the packages and runs `bun publish` in the same order, with your own npm login and no provenance.

## License

MIT, for the engine, the React pieces, the CLI and every item in `registry/`. See [LICENSE](LICENSE).
