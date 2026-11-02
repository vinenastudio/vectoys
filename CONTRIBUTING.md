# Contributing to vectoys

Thank you for making a toy. A toy is one item in the registry: a small React component with an `item.json`. This guide shows how to make one, check it and send it in.

## Make a toy

Outside this repository, start a new toy in its own folder:

```sh
npx @vinena/vectoys-cli create spinning-top
```

`create` writes `spinning-top/` with an `item.json`, a working component, a `package.json`, a `tsconfig.json` and a test. Pass `--dir <dir>` to put the folder somewhere else. It does not write over a folder that is already there unless you pass `--overwrite`.

In a clone of this repository, make it in `registry/` and run `bun install` so its packages link:

```sh
npx @vinena/vectoys-cli create spinning-top --dir registry
bun install
```

`npx @vinena/vectoys-cli skill` prints how a coding agent makes a toy, so you can point your agent at it.

## Preview it

```sh
npx @vinena/vectoys-cli preview spinning-top --open
```

`preview` renders the toy into `preview.html` in its folder, in light and dark side by side. `--open` opens the file. It needs [bun](https://bun.sh).

## Check it

```sh
npx @vinena/vectoys-cli check spinning-top
```

`check` prints a pass or fail line for each check and exits with 1 if any fails. It needs bun and the toy's packages installed. It checks that:

- `item.json` has the fields the registry needs.
- The files are under 96 KB together.
- Neither `item.json` nor the rendered text names a brand or a device maker.
- The component renders on the server.
- Two renders give the same markup.
- The markup has no `NaN` or `Infinity`.
- The toy has an accessible name: its root is `role="img"` with an `aria-label`, or its controls are labeled.

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

Imports are limited too. The component files import only each other, `react`, `@vinena/vectoys` and `@vinena/vectoys-react`. Those two vectoys packages are the only dependencies `item.json` may list.

### Folder rules

- No files whose name starts with a dot, except `.gitignore`.
- No `bunfig.toml`.
- No symlinks.
- `package.json` must stay as `vectoys create` writes it. Only the name and description may change.
- `tsconfig.json` may set only the options `vectoys create` writes.

### Tests

Tests may not use `globalThis`, `window` or `Bun`. Use the shared helpers in `packages/react/test/dom.tsx` instead: `installGlobal` to put a fake on the page, `readSibling` to read a file, `htmlOf` to read the markup of an element and `fireOnWindow` to send a window event.

### Visual tests

This part lands with the visual tests. Every toy's gallery preview has snapshot images in light, dark and reduced motion, and CI fails when one changes. A new toy needs its own snapshots. Run `bun run test:visual:update` (it needs Docker) and commit the new images with the toy. Look at each image before you commit it. Without Docker, take the images from the report of the failed `visual` job in CI.

## Submit it

Submissions open at launch.

```sh
npx @vinena/vectoys-cli submit spinning-top
```

`submit` runs `check` first and stops if any check fails. Then it uses the [GitHub CLI](https://cli.github.com) (`gh`) to fork this repository, copy your toy to `registry/<name>/` on a branch `item/<name>`, and open a pull request with the check results. Until launch, it checks and shows what it would send, and sends nothing.

To see what it would do without sending anything:

```sh
npx @vinena/vectoys-cli submit spinning-top --dry-run
```

## Credit

Put your name in `item.json`, on one line:

```json
"author": "Your Name (https://your.site)"
```

The gallery card shows it as "by Your Name", linked to your site. Keep it to one line of text, with no line breaks and no `*/`. Put a `credit` line in the header comment of each file too.

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
