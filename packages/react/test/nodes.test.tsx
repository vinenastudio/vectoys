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

test("useNodes gives one live set per name, so a set taken before its elements mount holds them once they do", async () => {
  let nodes: Nodes | undefined;
  const Late = ({ shown }: { shown: boolean }) => {
    nodes = useNodes();
    return <svg>{shown && <path ref={nodes.ref("late")} />}</svg>;
  };
  const { host, rerender } = await mount(<Late shown={false} />);
  const early = nodes?.all("late");
  expect([...(early ?? [])]).toHaveLength(0);
  await rerender(<Late shown />);
  expect(nodes?.all("late")).toBe(early);
  expect([...(early ?? [])]).toEqual([...host.querySelectorAll("path")]);
});
