---
name: vectoys
description: Use when making a 3D device or toy for a landing page with vectoys (a laptop, a phone, a gift box, a keycap, any small object drawn as SVG paths), when editing a vectoys item, or when checking and submitting one to the vectoys registry.
---

# Make a vectoys item

vectoys draws 3D objects as plain SVG paths. An item is a small React component plus its geometry: it renders on the server, stays sharp at any size, and can carry live HTML on a face. `@vinena/vectoys` turns parts into paths. `@vinena/vectoys-react` draws them. Items copy into a project as source with `npx @vinena/vectoys-cli add <name>`.

## Workflow

1. `npx @vinena/vectoys-cli create <name>` writes `./<name>/` (or under `--dir <dir>`): `item.json`, `src/geometry.ts`, `src/<name>.tsx`, `src/index.ts`, a test, `package.json` and `tsconfig.json`. It renders a shaded, tilted slab. Under `registry/` of a vectoys checkout it uses the workspace's packages, which `bun install` links. Anywhere else it asks for `@vinena/vectoys` and `@vinena/vectoys-react` from npm by version: install them with `npm install` (or your package manager) in the item folder before you check it.
2. Edit `src/geometry.ts` (parts, camera, poses) and `src/<name>.tsx` (looks, motion, interaction). Write a real `title` and `description` in `item.json`. List every source file in `files`.
3. `npx @vinena/vectoys-cli check <dir>` runs 8 checks: item.json is valid, the files are under 96 KB together, item.json names no brand, the component renders on the server with no props, the markup has no `NaN` or `Infinity`, two renders give the same markup, the rendered text names no brand, and the root has an accessible name. It needs bun. Fix every FAIL line.
4. `npx @vinena/vectoys-cli preview <dir>` writes `<dir>/preview.html` (`--open` opens it): the item rendered on the server in light and dark, and at a row of yaws when the component takes a `yaw` prop. Look at it. Faces drawn in the wrong order, gaps, and parts that float show here, not in the checks.
5. Iterate on 2 to 4 until it looks right in both themes and at every yaw.
6. `npx @vinena/vectoys-cli submit <dir>` runs the checks, then opens a pull request (it needs the GitHub CLI, `gh`) that adds the item to vinenastudio/vectoys. If you host your own registry, `npx @vinena/vectoys-cli submit --registry <url>` opens a pull request that lists it. Until submissions open at launch, submit prints what it would send and sends nothing. `--dry-run` does the same at any time.

## The model

Units are scene units. The camera's `width` (100 by default) and `height` are the SVG viewBox. Pick a scale such as `const mm = (v: number) => v * 0.4` and write real sizes.

Axes. A part's own plane is x right, y down, z out of its top face. The model is x across, y toward the front, z up. A part lying flat faces up. Stand it upright toward the eye with `rotation: rotateX(-90)`.

Parts (`@vinena/vectoys`):

- `slab({ name, box, radii, thickness, edge, bevel, taper, pose, order, children, step, outline })`: a rounded rectangle `box: [left, top, right, bottom]` with corner `radii: [top, bottom]`, `thickness` deep. The top face is at z = 0 and the bottom at z = -thickness. `edge` rounds the side band (`bevel: "chamfer"` cuts it flat instead). `taper` leans the sides in, as a keycap's do.
- `plate({ name, box, radii, lift, role, pose, order, children })`: a flat face `lift` (0.02 by default) over its parent's z = 0: glass, a label, a trackpad, a ribbon band.
- `outline`: a convex, clockwise list of points that replaces the rounded box (an envelope's triangle flap). `box` still bounds it.
- `step`: the spacing of points round a corner (0.1 by default). Use 0.5 or more on a part that moves every frame, so fewer faces draw.

A scene is `Part[]`. Children sit in their parent's space, so a lid is a child posed at its hinge.

Poses and joints. A `Pose` is `{ position: [x, y, z], rotation }`. Build rotations with `rotateX`, `rotateY`, `rotateZ` (degrees, the same way round as CSS), `rotateAxis(axis, degrees)`, and join them with `combine(a, b, c)` (read like a CSS transform list: the last turns first). `IDENTITY` and `REST` are the no-turn rotation and pose. For a joint, compute the child's pose from a number (an open share, an angle) in a function such as `lidPose(open)`. Use `slerp(from, to, share)` to blend two rotations. To turn about a point that is not the part's origin, rotate the offset with `rotate(rotation, offset)` and add it to the position.

Camera. `camera({ width, height, perspective, yaw, pitch, roll, anchorX, anchorY, back, originX, originY })`. `perspective` about 280 to 400 for a scene 100 wide. `yaw` turns the model about its up axis and `pitch` tips it to or from the eye. A device at rest usually sits near `yaw: -24, pitch: -16`.

Drawing. `draw(scene, eye)` returns `{ faces, hulls }`: the faces that face the eye, far to near, and each part's silhouette. Parts sort by `order` first, then by depth. Leave `order` out unless two parts draw in the wrong order: parts that interlock, or one that swings past another's center (a lid over its base). Then give the part in front a higher `order`.

`footprint(scene, eye, { gap, spread, ahead })` is the shadow on the ground under the model. Draw it first, blurred if you like. `poses(scene)` maps each part's name to its pose in the scene, for laying a screen on a child part.

Keep `seen(...)` in `geometry.ts`: one pure function from the item's state (open share, hover lift, yaw) to `{ camera, drawn, ... }`. The component calls it inside `useMemo`.

## Looks and shading

`<Faces faces hulls styles shading />` draws what `draw` returned. `styles` maps a role to SVG path props: `top`, `side`, `bottom`, a plate's `role`, or `"part.role"` for one part only (`"body.top"`, `"knot.side"`). Write fills as `style: { fill }`.

Take colors from the page's CSS variables, each with a fallback so the item shows before the page sets them:

- `--vectoys-finish`: the main material. Expose a `finish` prop that sets it.
- `--vectoys-surface`, `--vectoys-hairline`, `--vectoys-shadow`, `--vectoys-accent`, `--vectoys-ink`, `--vectoys-bg`. Add an item variable such as `--vectoys-paper` only when none of these fits.
- `--vectoys-focus` and `--vectoys-focus-width` for focus rings.

Mix tones with `color-mix(in srgb, ...)` instead of new colors. `shading` darkens faces turned from the light and lifts the few turned right at it. The page tunes it with `--vectoys-shade-strength` (0.5), `--vectoys-shade-color`, `--vectoys-highlight-strength` (0.25) and `--vectoys-highlight`. Draw a hairline outline over the main body's hull with `vectorEffect: "non-scaling-stroke"`. Check the item on a dark page too.

## Live HTML on a face

`<Stage camera overlay role label style>` is the box. It keeps the camera's aspect ratio and scales with its parent. Put a `<Screen camera pose rect width>` in `overlay` to lay live HTML on a face. `rect` is a `ScreenRect` `{ x, y, width, height, z }` in the part's own plane. `width` is the CSS pixels the content lays out at. The Screen hides its content while the face points away. Round its corners with `borderRadius` as a share of the rect, and set `overflow: "hidden"`.

## Motion

- `useSpring(target, { stiffness, damping })` returns a number that springs to `target` each frame. Feed it into `seen`.
- `useFrames()` returns `run(step)`. It calls `step(elapsedMs)` every frame until `step` returns false. Use it for timed runs or several springs at once, with `spring` and `settled` from the engine.
- `useReducedMotion()` is true when the page asks for less motion. `useSpring` already jumps straight to its target then. In your own `useFrames` loop, set the end state at once instead.

## Server rendering must be deterministic

The same props must give the same markup on the server and the client, every time:

- Write fixed numbers. Do not use `Math.random()`, `Date`, `performance.now()` or `window` during render. Start motion in effects.
- Round numbers you put in styles with `fixed()` from the engine.
- Make SVG ids unique per instance with `useId()` (strip characters other than `\w` and `-`), so two items share a page.
- The component must render with no props at all.

## Accessibility

- A picture: the root is `role="img"` with an `aria-label` (Stage takes `role` and `label`). With live content inside, use `role="group"` so its links stay reachable.
- Interactive: use a real `<button>` or `<a href>` with a label, laid over the item's bounds. Give it a visible `:focus-visible` ring in `--vectoys-focus`. Enter and Space must do what a click does: a native button already does this, so do not call `preventDefault` on those keys or the click is cancelled.
- Respect reduced motion: the state still changes, only without the motion.
- Start hover effects only when `event.pointerType === "mouse"`, so a tap does not stick in the hover state.

## Rules

- No brand, maker or product names (no trademarked device names) in item.json, the code or the rendered text. Make a generic phone, not a named one.
- Keep the files under 96 KB together. Most items need far less; the limit leaves room for a device item with a full 3D model and a hand-drawn front.
- React 19. Depend only on `@vinena/vectoys`, `@vinena/vectoys-react` and React. No other packages.
- TypeScript strict. One component per item, named after the item (`my-toy` exports `MyToy`).
- Props: `label`, `finish`, `yaw` (and `pitch`) for a device that turns, and the state as controlled plus default (`open` and `defaultOpen` with `onOpenChange`), as the registry items do.

## Example

A badge that lifts toward the mouse and shows live HTML on its face. It passes all 8 checks.

`src/geometry.ts`:

```ts
import { camera, draw, footprint, plate, rotateX, slab, type Pose, type Scene, type ScreenRect } from "@vinena/vectoys";

const WIDTH = 60;
const HEIGHT = 40;
const DEEP = 4;
export const FACE: ScreenRect = { x: -25, y: -15, width: 50, height: 30, z: 0.03 };

const scene = (pose: Pose): Scene => [
  slab({
    name: "body",
    box: [-WIDTH / 2, -HEIGHT / 2, WIDTH / 2, HEIGHT / 2],
    radii: [6, 6],
    thickness: DEEP,
    edge: 1.2,
    pose,
    children: [plate({ name: "face", box: [FACE.x, FACE.y, FACE.x + FACE.width, FACE.y + FACE.height], radii: [3, 3], role: "face" })],
  }),
];

/** The badge `lift` of the way up from rest (0 to 1): the camera, the faces, the face's pose and the shadow. */
export function seen(lift = 0) {
  const eye = camera({ width: 100, height: 80, perspective: 280, yaw: -24 + lift * 12, pitch: -16 });
  // Stood upright, face to the eye, and raised a little as it lifts.
  const pose: Pose = { position: [0, DEEP / 2, lift * 3], rotation: rotateX(-90) };
  const parts = scene(pose);
  return { camera: eye, drawn: draw(parts, eye), face: pose, shadow: footprint(parts, eye, { gap: 2, spread: 1.5 }).d };
}
```

`src/badge.tsx`:

```tsx
import { Faces, Screen, Stage, useSpring, type Look } from "@vinena/vectoys-react";
import { useMemo, useState, type ReactNode } from "react";
import { FACE, seen } from "./geometry";

const FINISH = "var(--vectoys-finish, #5b7cfa)";
const SURFACE = "var(--vectoys-surface, #f5f5f5)";
const SHADOW = "var(--vectoys-shadow, rgba(0, 0, 0, 0.08))";
const fill = (color: string): Look => ({ style: { fill: color } });
const STYLES: Record<string, Look> = { top: fill(FINISH), side: fill(FINISH), bottom: fill(FINISH), face: fill(SURFACE) };

/** A badge that lifts and turns toward a mouse over it, with live HTML on its face. */
export function Badge({ children, label = "Badge" }: { children?: ReactNode; label?: string }) {
  const [over, setOver] = useState(false);
  // Springs to its target each frame; under reduced motion it jumps there.
  const lift = useSpring(over ? 1 : 0, { stiffness: 260, damping: 24 });
  const view = useMemo(() => seen(lift), [lift]);
  const screen = (
    <Screen camera={view.camera} pose={view.face} rect={FACE} width={250} style={{ overflow: "hidden", borderRadius: 14 }}>
      {children}
    </Screen>
  );
  return (
    <div
      role={children == null ? "img" : "group"}
      aria-label={label}
      onPointerEnter={(event) => event.pointerType === "mouse" && setOver(true)}
      onPointerLeave={() => setOver(false)}
    >
      <Stage camera={view.camera} overlay={screen}>
        <path d={view.shadow} style={{ fill: SHADOW }} />
        <Faces faces={view.drawn.faces} hulls={view.drawn.hulls} styles={STYLES} shading />
      </Stage>
    </div>
  );
}
```

## Before you submit

- `npx @vinena/vectoys-cli check <dir>` passes all 8 checks.
- The preview looks right in light and dark and at every yaw.
- Pointer, touch and keyboard all work, and reduced motion keeps the state changes.
- `item.json` has a plain title and a description that says what the item is and what it does.
