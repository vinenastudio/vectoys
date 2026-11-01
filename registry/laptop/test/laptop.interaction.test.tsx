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
