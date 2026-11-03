# Contributing to vectoys

Thank you for making a toy. A toy is one item in the registry: a small React component with an `item.json`. This guide shows how to make one, check it and send it in.

## Make a toy

Outside this repository, start a new toy in its own folder:

```sh
npx @vinena/vectoys-cli create spinning-top
```

`create` writes `spinning-top/` with an `item.json`, a working component, a `package.json`, a `tsconfig.json` and a test. Pass `--dir <dir>` to put the folder somewhere else. It does not write over a folder that is already there unless you pass `--overwrite`.

Then install its packages with your package manager, in the new folder, before you preview or check it:

```sh
cd spinning-top
npm install
```

The commands below then take `.` as the folder, or leave it out.

In a clone of this repository, make it in `registry/` and run `bun install` so its packages link. `create` writes `registry/spinning-top/`, so use that path in the commands below:

```sh
npx @vinena/vectoys-cli create spinning-top --dir registry
bun install
```

`npx @vinena/vectoys-cli skill` prints how a coding agent makes a toy, so you can point your agent at it.

## Turn and full screen

Every toy wraps itself in `Turntable` from `@vinena/vectoys-react`, as the toy `create` writes does. A mouse, a finger or the arrow keys turn the toy, and a button in its corner shows it full screen.

- Use `mode="camera"` for a toy with a real 3D camera. Pass a function as the child: Turntable calls it with the turn in degrees, and the toy adds it to its own `yaw` and `pitch`, as in `<Turntable mode="camera">{(turn) => <Drawn yaw={yaw + turn.yaw} pitch={pitch + turn.pitch} />}</Turntable>`. Plain children get no turn.
- Use `mode="tilt"` only for a flat toy with no 3D model, such as art drawn for one view. Turntable tilts it a little with a CSS transform, seen from about three times its width away. A toy drawn from a 3D model uses `mode="camera"`, even when it rests at one fixed eye: add the turn to that eye, or a tilt of the drawing reads as a flat sticker. No registry toy uses `Turntable mode="tilt"`: the envelope, all flat sheets, turns its camera too.
- Take `TurnOptions` in the toy's props and pass them on: `draggable` (default `true`), `fullscreen` (default `true`), `limits` (how far it turns each way, in degrees) and `release` (`"stay"` by default, where a double click resets it, or `"return"` to spring back to rest).
- Links, buttons and form fields never start a drag. Put `data-vectoys-nodrag` on other parts that must never start one, such as keys. Put `data-vectoys-grab` on a big button or link that covers the toy, such as a die or an envelope's front, so a drag on it still turns the toy and a click still presses it.

## Preview it

The examples use the clone path `registry/spinning-top`. Outside the repository, use your own folder.

```sh
npx @vinena/vectoys-cli preview registry/spinning-top --open
```

`preview` renders the toy into `preview.html` in its folder, in light and dark side by side. `--open` opens the file. It needs [bun](https://bun.sh).

## Check it

```sh
npx @vinena/vectoys-cli check registry/spinning-top
```

`check` prints a pass or fail line for each check and exits with 1 if any fails. It needs bun and the toy's packages installed. It checks that:

- `item.json` has the fields the registry needs.
- The files are under 96 KB together.
- Neither `item.json` nor the rendered text names a brand or a device maker.
- The component is in `src/<name>.tsx`, which `item.json` lists, and that file exports the toy's component name (`spinning-top` exports `SpinningTop`).
- The component renders on the server.
- Two renders give the same markup.
- The markup has no `NaN` or `Infinity`.
- The toy has an accessible name: its root is `role="img"` with an `aria-label`, or its controls are labeled. An interactive toy, or one with links inside, can use a root with `role="group"` and an `aria-label` instead. That root goes inside the Turntable.
- The toy uses `Turntable`, so it turns and fills the screen.

### Safety

`check` catches common unsafe patterns; a maintainer reviews every submission before it is listed. It reads every code file in the folder, tests included, before it renders anything, so code that fails never runs. A file fails if it uses:

- The server runtime (`Bun`, `process`, `require`, `globalThis`) or the window object (`window`, `self`, `opener`, `defaultView`).
- Scripts, frames, objects, embeds or forms.
- `innerHTML` or `dangerouslySetInnerHTML`.
- `eval` or `Function`.
- Network calls, workers, `postMessage` or the clipboard.
- `window.open` or `location`.
- Dynamic imports or browser storage.
- Outside URLs or `javascript:` URLs, in the source or in the rendered markup.

Imports are limited too. The component files import only each other, `react`, `@vinena/vectoys` and `@vinena/vectoys-react`, and the other toys `registryDependencies` lists. Those two vectoys packages are the only dependencies `item.json` may list.

### Use another toy

Reuse a toy that already exists; do not copy or redraw it. To build on the laptop, list it in `item.json` and import it by its package name:

```json
"registryDependencies": ["laptop"]
```

```tsx
import { Laptop } from "@vectoys/laptop";
```

Add `"@vectoys/laptop": "workspace:*"` to the toy's `package.json` dependencies and run `bun install`, so the workspace links it. Import only what the toy's component file exports, here `src/laptop.tsx`, as that is the file a project gets. The registry build points the import at `../laptop/laptop`, where `vectoys add` and the shadcn CLI put the laptop, and the item's JSON lists the laptop's URL so both add it first. `check` renders the toy only inside a clone of this repository, where the workspace finds the laptop.

### Folder rules

- No files whose name starts with a dot, except `.gitignore`.
- No `bunfig.toml`.
- No symlinks.
- `package.json` must stay as `vectoys create` writes it. Only the name and description may change, and each item listed in `registryDependencies` may be added to its dependencies as `"@vectoys/<name>": "workspace:*"`.
- `tsconfig.json` may set only the options `vectoys create` writes.

### Tests

Tests may not use `globalThis`, `window` or `Bun`. Outside the repository, keep tests to `bun:test` and `react-dom/server`, as the test `create` writes does. In a clone of this repository, tests may also use the shared helpers in `packages/react/test/dom.tsx`: `installGlobal` to put a fake on the page, `readSibling` to read a file, `htmlOf` to read the markup of an element and `fireOnWindow` to send a window event.

### Visual tests

This applies once pull request #24 (visual tests) merges. Every toy's gallery preview has snapshot images in light, dark and reduced motion, and CI fails when one changes. A new toy needs its own snapshots. Run `bun run test:visual:update` (it needs Docker) and commit the new images with the toy. Look at each image before you commit it. If you cannot run Docker, send the toy without them: CI skips the visual test of a toy that is new in the pull request and has no snapshots, shows a neutral check named `visual: needs maintainer baseline`, and comments on the pull request. A maintainer then makes and commits the snapshots. A toy that is already on the base branch is always checked, so a missing or changed snapshot of it fails CI.

## Submit it

Submissions are open. `npx @vinena/vectoys-cli submit <dir>` (it needs the GitHub CLI, `gh`, and bun 1.3.2 or newer) opens the pull request for you. You can also open it by hand: fork the repository, add your toy under `registry/<name>/` on a branch `item/<name>`, and open a pull request. A maintainer reviews every toy.

```sh
npx @vinena/vectoys-cli submit registry/spinning-top
```

`submit` runs `check` first and stops if any check fails. It needs bun 1.3.2 or newer. Then it uses the [GitHub CLI](https://cli.github.com) (`gh`) to fork this repository, copy your toy to `registry/<name>/` on a branch `item/<name>` (the files `item.json` lists, its `package.json`, `tsconfig.json`, `src/index.ts` and `test/`), add the toy's package to `bun.lock`, and open a pull request with the check results.

With `--dry-run` it runs the checks, says what it would send, and sends nothing:

```sh
npx @vinena/vectoys-cli submit registry/spinning-top --dry-run
```

## Credit

Put your name in `item.json`, on one line. `create` fills it in from your git name:

```json
"author": "Your Name (https://your.site)"
```

The gallery card shows it as "by Your Name", linked to your site. Keep it to one line of text, with no line breaks and no `*/`.

The registry build adds a license and credit header to each file for you, so do not add one yourself. The credit in that header is your `author` by default. To credit someone else too, set the optional `credit` field in `item.json`, also one line of text.

## Gallery preview

The gallery preview is made for you. It shows the component your toy exports as `Demo`, else its main component, else its default export. You do not need to change the site.

## The quality bar

- Draw generic objects. No maker's product, no logo, no brand name.
- It looks right in light and dark.
- It respects `prefers-reduced-motion`.
- It works with a keyboard and a screen reader.
- It renders on the server.
- It stays small.

## License and sign-off

Everything in this repository is MIT. By sending a toy, you agree that it is MIT too.

Sign off each commit with the [Developer Certificate of Origin](https://developercertificate.org):

```sh
git commit -s
```

This adds a `Signed-off-by` line that says you have the right to send the work.

## Code of conduct

Please follow the [code of conduct](CODE_OF_CONDUCT.md). To report a security problem, see [SECURITY.md](SECURITY.md).
