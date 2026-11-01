import { afterEach, expect, test } from "bun:test";
import { useNodes, type Nodes } from "../src";
import { mount } from "./dom";

afterEach(() => document.body.replaceChildren());

test("useNodes keeps every mounted element under its name, with the same ref callback each render", async () => {
  let nodes: Nodes | undefined;
  const refs: unknown[] = [];
  const Named = ({ two }: { two: boolean }) => {
    nodes = useNodes();
    refs.push(nodes.ref("part"));
    return (
      <svg>
        <path ref={nodes.ref("part")} />
        {two && <path ref={nodes.ref("part")} />}
        <path ref={nodes.ref("other")} />
      </svg>
    );
  };
  const { rerender } = await mount(<Named two />);
  expect([...(nodes?.all("part") ?? [])]).toHaveLength(2);
  expect([...(nodes?.all("other") ?? [])]).toHaveLength(1);
  expect([...(nodes?.all("missing") ?? [])]).toHaveLength(0);
  await rerender(<Named two={false} />);
  expect([...(nodes?.all("part") ?? [])]).toHaveLength(1);
  expect(new Set(refs).size).toBe(1);
});
