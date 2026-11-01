import { afterEach, expect, spyOn, test } from "bun:test";
import { act, createRef } from "react";
import { mount } from "../../../packages/react/test/dom";
import { DESK, FRONT, Laptop, PHONE, type LaptopHandle } from "../src";

afterEach(() => document.body.replaceChildren());

test("FRONT renders on the client with no React warnings", async () => {
  const errors = spyOn(console, "error");
  try {
    const { host } = await mount(
      <Laptop eye={FRONT}>
        <p>live</p>
      </Laptop>,
    );
    expect(host.querySelector("p")?.textContent).toBe("live");
    expect(errors.mock.calls.map((call) => String(call[0]))).toEqual([]);
  } finally {
    errors.mockRestore();
  }
});

/**
 * The stage's markup with each laptop's own ids made one and every style's
 * declarations sorted, to compare two laptops: a style the handle writes
 * again goes to the end of its attribute.
 */
const markup = (host: HTMLElement) =>
  (host.firstElementChild?.outerHTML ?? "")
    .replace(/laptop-(desk|phone)-[\w-]*?-(?=deck|far|near|sheen|lid-|holes)/g, "laptop-$1-X-")
    .replace(/style="([^"]*)"/g, (_, style: string) => `style="${style.split(/;\s*/).filter(Boolean).sort().join(";")}"`);

const Live = ({ text = "live" }: { text?: string }) => <p>{text}</p>;

test("the handle draws a pose as the props would, with no render", async () => {
  const handle = createRef<LaptopHandle>();
  let renders = 0;
  const Counted = () => {
    renders += 1;
    return <p>live</p>;
  };
  const moved = await mount(
    <Laptop eye={DESK} turning ref={handle}>
      <Counted />
    </Laptop>,
  );
  for (const pose of [{ lid: 0.4, yaw: -20, pitch: 25 }, { lid: 1, yaw: 35, pitch: 5 }, { lid: 0, yaw: 10, pitch: 30 }, { lid: 0.7, yaw: 0, pitch: 15 }]) {
    await act(async () => handle.current?.set(pose));
    const drawn = await mount(
      <Laptop eye={DESK} turning ref={createRef<LaptopHandle>()} {...pose}>
        <p>live</p>
      </Laptop>,
    );
    expect(markup(moved.host)).toBe(markup(drawn.host));
    await drawn.unmount();
  }
  expect(renders).toBe(1);
});

test("set changes only what it is given, and holds a pose to its ranges", async () => {
  const handle = createRef<LaptopHandle>();
  const moved = await mount(
    <Laptop eye={PHONE} turning ref={handle}>
      <Live />
    </Laptop>,
  );
  await act(async () => handle.current?.set({ yaw: 90 }));
  await act(async () => handle.current?.set({ lid: 0.5 }));
  const drawn = await mount(
    <Laptop eye={PHONE} turning lid={0.5} yaw={35} ref={createRef<LaptopHandle>()}>
      <Live />
    </Laptop>,
  );
  expect(markup(moved.host)).toBe(markup(drawn.host));
});

test("a render for new content keeps the handle's pose, and a new pose prop wins", async () => {
  const handle = createRef<LaptopHandle>();
  const page = (yaw: number, text: string) => (
    <Laptop eye={DESK} turning yaw={yaw} ref={handle}>
      <Live text={text} />
    </Laptop>
  );
  const fresh = async (props: { yaw: number; lid?: number }, text: string) => {
    const drawn = await mount(
      <Laptop eye={DESK} turning ref={createRef<LaptopHandle>()} {...props}>
        <Live text={text} />
      </Laptop>,
    );
    const html = markup(drawn.host);
    await drawn.unmount();
    return html;
  };
  const moved = await mount(page(0, "one"));
  await act(async () => handle.current?.set({ yaw: -25, lid: 0.6 }));
  await moved.rerender(page(0, "two"));
  expect(markup(moved.host)).toBe(await fresh({ yaw: -25, lid: 0.6 }, "two"));
  await moved.rerender(page(15, "two"));
  expect(markup(moved.host)).toBe(await fresh({ yaw: 15 }, "two"));
});

test("nearly shut, the lid faces away and the handle hides the glass", async () => {
  const handle = createRef<LaptopHandle>();
  const { host } = await mount(
    <Laptop eye={DESK} ref={handle}>
      <Live />
    </Laptop>,
  );
  const glass = host.querySelector("p")?.closest<HTMLElement>("[style*='matrix3d'], [style*='visibility']");
  expect(glass?.style.visibility).toBe("visible");
  await act(async () => handle.current?.set({ lid: 0.1 }));
  expect(glass?.style.visibility).toBe("hidden");
  await act(async () => handle.current?.set({ lid: 1 }));
  expect(glass?.style.visibility).toBe("visible");
});

test("seen from the front, the handle does nothing", async () => {
  const handle = createRef<LaptopHandle>();
  const { host } = await mount(<Laptop eye={FRONT} ref={handle} />);
  const before = host.innerHTML;
  await act(async () => handle.current?.set({ lid: 0, yaw: 30 }));
  expect(host.innerHTML).toBe(before);
});

test.each([
  ["turning off", { eye: DESK, turning: true }, { eye: DESK, turning: false }],
  ["turning on", { eye: DESK, turning: false }, { eye: DESK, turning: true }],
  ["another eye", { eye: DESK, turning: true }, { eye: PHONE, turning: true }],
] as const)("with %s while the handle holds a pose, the props' pose is drawn whole", async (_, before, after) => {
  const handle = createRef<LaptopHandle>();
  const moved = await mount(
    <Laptop {...before} ref={handle}>
      <Live />
    </Laptop>,
  );
  await act(async () => handle.current?.set({ yaw: 20, lid: 0.3 }));
  await moved.rerender(
    <Laptop {...after} ref={handle}>
      <Live />
    </Laptop>,
  );
  const drawn = await mount(
    <Laptop {...after} ref={createRef<LaptopHandle>()}>
      <Live />
    </Laptop>,
  );
  expect(markup(moved.host)).toBe(markup(drawn.host));
});

/** `markup`, with a free laptop's own gradient and filter names made one too. */
const freeMarkup = (host: HTMLElement) => markup(host).replace(/laptop-(desk|phone)-[\w-]*?-(?=face|ends|streak|hinge|edge|rim|wall|floor|feet|foot|soft|scoop)/g, "laptop-$1-X-");

const POSES = [
  { lid: 1, flat: 1 },
  { lid: 0.3, flat: 1, y: 0.4 },
  { lid: 0, flat: 0.6, roll: 140, yaw: 100, y: 0.5, scale: 1.1 },
  { lid: 0, flat: 0.2, roll: 220, yaw: 250, x: -0.3 },
  { lid: 0, flat: 0, roll: 300, yaw: 175 },
  { lid: 0.7, flat: 0, pitch: -20, yaw: 160 },
  { lid: 1, flat: 0 },
];

test.each([DESK, PHONE])("a free laptop's handle draws every pose as its props would, from the underside and the back too, with no render", async (eye) => {
  const handle = createRef<LaptopHandle>();
  let renders = 0;
  const Counted = () => {
    renders += 1;
    return <p>live</p>;
  };
  const moved = await mount(
    <Laptop eye={eye} free ref={handle}>
      <Counted />
    </Laptop>,
  );
  for (const pose of POSES) {
    await act(async () => handle.current?.set({ x: 0, y: 0, scale: 1, roll: 0, yaw: 0, pitch: eye.pitch, ...pose }));
    const drawn = await mount(
      <Laptop eye={eye} free ref={createRef<LaptopHandle>()} {...pose}>
        <p>live</p>
      </Laptop>,
    );
    expect(freeMarkup(moved.host)).toBe(freeMarkup(drawn.host));
    await drawn.unmount();
  }
  expect(renders).toBe(1);
});

test("not free, a laptop moved by its new fields holds its turns to their ranges; free, it does not", async () => {
  const draw = async (props: object, pose: object) => {
    const handle = createRef<LaptopHandle>();
    const moved = await mount(
      <Laptop eye={DESK} {...props} ref={handle}>
        <Live />
      </Laptop>,
    );
    await act(async () => handle.current?.set(pose));
    const html = freeMarkup(moved.host);
    await moved.unmount();
    return html;
  };
  expect(await draw({ flat: 0 }, { roll: 200, yaw: 90, pitch: 60, lid: 3, flat: 2 })).toBe(await draw({ flat: 0 }, { roll: 35, yaw: 35, pitch: 30, lid: 1, flat: 1 }));
  expect(await draw({ free: true }, { roll: 200, yaw: 90 })).not.toBe(await draw({ free: true }, { roll: 35, yaw: 35 }));
});

test("seen from under the deck or shut, a free laptop hides the glass, and shows it again open from above", async () => {
  const handle = createRef<LaptopHandle>();
  const { host } = await mount(
    <Laptop eye={DESK} free ref={handle}>
      <Live />
    </Laptop>,
  );
  const glass = host.querySelector("p")?.closest<HTMLElement>("[style*='matrix3d'], [style*='visibility']");
  expect(glass?.style.visibility).toBe("visible");
  await act(async () => handle.current?.set({ lid: 0, roll: 180 }));
  expect(glass?.style.visibility).toBe("hidden");
  await act(async () => handle.current?.set({ lid: 1, roll: 0, flat: 1 }));
  expect(glass?.style.visibility).toBe("visible");
});

test("a free laptop's parts reorder in the page as the eye goes round them, and a render puts them back as drawn", async () => {
  const handle = createRef<LaptopHandle>();
  const page = (yaw: number) => (
    <Laptop eye={DESK} free yaw={yaw} lid={1} ref={handle}>
      <Live />
    </Laptop>
  );
  const moved = await mount(page(0));
  const order = () => [...(moved.host.querySelector("svg > g:last-of-type")?.children ?? [])].map((part) => (part.querySelector("[fill*='-edge']") ? "lid" : part.querySelector("[fill*='-face']") ? "base" : "feet"));
  const first = order();
  expect(first).toEqual(["lid", "feet", "base"]);
  await act(async () => handle.current?.set({ yaw: 180 }));
  expect(order()).toEqual(["feet", "base", "lid"]);
  await moved.rerender(page(10));
  expect(order()).toEqual(first);
});

test.each([true, false])("with free turned %p while the handle holds a pose, the props' pose is drawn whole", async (from) => {
  const handle = createRef<LaptopHandle>();
  const page = (free: boolean) => (
    <Laptop eye={DESK} flat={0} free={free} ref={handle}>
      <Live />
    </Laptop>
  );
  const moved = await mount(page(from));
  await act(async () => handle.current?.set({ yaw: 120, roll: 200, lid: 0.4 }));
  await moved.rerender(page(!from));
  const drawn = await mount(
    <Laptop eye={DESK} flat={0} free={!from} ref={createRef<LaptopHandle>()}>
      <Live />
    </Laptop>,
  );
  expect(freeMarkup(moved.host)).toBe(freeMarkup(drawn.host));
});

/** `freeMarkup`, with the realistic look's sheens made one too. */
const realMarkup = (host: HTMLElement) => freeMarkup(host).replace(/laptop-(desk|phone)-[\w-]*?-(?=top"|outer"|under"|dish"|pane"|grain"|keys"|top\)|outer\)|under\)|dish\)|pane\)|grain\))/g, "laptop-$1-X-");

test.each([DESK, PHONE])("a realistic laptop's handle draws every pose as its props would, with no render", async (eye) => {
  const handle = createRef<LaptopHandle>();
  let renders = 0;
  const Counted = () => {
    renders += 1;
    return <p>live</p>;
  };
  const moved = await mount(
    <Laptop eye={eye} look="realistic" free ref={handle}>
      <Counted />
    </Laptop>,
  );
  for (const pose of POSES) {
    await act(async () => handle.current?.set({ x: 0, y: 0, scale: 1, roll: 0, yaw: 0, pitch: eye.pitch, ...pose }));
    const drawn = await mount(
      <Laptop eye={eye} look="realistic" free ref={createRef<LaptopHandle>()} {...pose}>
        <p>live</p>
      </Laptop>,
    );
    expect(realMarkup(moved.host)).toBe(realMarkup(drawn.host));
    await drawn.unmount();
  }
  expect(renders).toBe(1);
});

test("a realistic laptop that is not free takes the lid, yaw and pitch from its handle, held to their ranges", async () => {
  const handle = createRef<LaptopHandle>();
  const moved = await mount(
    <Laptop eye={DESK} look="realistic" turning ref={handle}>
      <Live />
    </Laptop>,
  );
  await act(async () => handle.current?.set({ lid: 0.4, yaw: 90, pitch: 60 }));
  const drawn = await mount(
    <Laptop eye={DESK} look="realistic" turning lid={0.4} yaw={35} pitch={30} ref={createRef<LaptopHandle>()}>
      <Live />
    </Laptop>,
  );
  expect(realMarkup(moved.host)).toBe(realMarkup(drawn.host));
});

test.each([
  ["free", { free: true }],
  ["not free", { turning: true }],
] as const)("%s, changing the look while the handle holds a pose lets go of it, and the props' pose is drawn whole", async (_, props) => {
  for (const [from, to] of [
    ["simple", "realistic"],
    ["realistic", "simple"],
  ] as const) {
    const handle = createRef<LaptopHandle>();
    const page = (look: "simple" | "realistic") => (
      <Laptop eye={DESK} {...props} look={look} lid={1} yaw={0} ref={handle}>
        <Live />
      </Laptop>
    );
    const moved = await mount(page(from));
    await act(async () => handle.current?.set({ lid: 0.3, yaw: 25, pitch: 28 }));
    await moved.rerender(page(to));
    const drawn = await mount(
      <Laptop eye={DESK} {...props} look={to} lid={1} yaw={0} ref={createRef<LaptopHandle>()}>
        <Live />
      </Laptop>,
    );
    expect(realMarkup(moved.host)).toBe(realMarkup(drawn.host));
    // The handle keeps working after the change, and holds what it sets.
    await act(async () => handle.current?.set({ lid: 0.5 }));
    const held = await mount(
      <Laptop eye={DESK} {...props} look={to} lid={0.5} yaw={0} ref={createRef<LaptopHandle>()}>
        <Live />
      </Laptop>,
    );
    expect(realMarkup(moved.host)).toBe(realMarkup(held.host));
    for (const done of [moved, drawn, held]) await done.unmount();
  }
});
