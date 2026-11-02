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

It also checks that the code is safe to copy into other people's projects:

- No `<script>` elements.
- No `dangerouslySetInnerHTML`.
- No `eval` or `new Function`.
- No network calls: no `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` or `import()` of a URL.
- Only the allowed runtime dependencies: `@vinena/vectoys`, `@vinena/vectoys-react` and `react`.
- No external `http` or `https` URLs in SVG `href` or `xlink:href`.

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

Put your name in `item.json`:

```json
"author": "Your Name (https://your.site)"
```

The gallery shows it as "by Your Name". Put a `credit` line in the header comment of each file too.

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
