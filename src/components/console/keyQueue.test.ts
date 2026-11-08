import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { holdable, KEY_WAIT_MS, keyQueue, type HeldKey } from "./keyQueue";

// A model of the Held queue with the panel docked: the keys as the console handles them, a save that takes 350ms, and
// the next claim's panel that loads in 200ms. Keys go through the queue as the console's capture listener sends them.
function console3() {
  const claims = ["RM-5250", "RM-8843", "RM-9629"];
  const s = { open: 0, ready: true, saving: false, mode: "idle" as "idle" | "approve" | "reject", reason: "", tab: "held", log: [] as string[] };
  const save = (what: string) => {
    s.saving = true;
    setTimeout(() => {
      s.log.push(`${what} ${claims[s.open]}`);
      s.saving = false;
      s.mode = "idle";
      s.reason = "";
      s.open += 1;
      s.ready = false;
      setTimeout(() => (s.ready = true), 200);
    }, 350);
  };
  const handle = (k: HeldKey) => {
    if (s.mode === "reject") {
      if (/^[1-4]$/.test(k.key) && !s.reason) s.reason = `quick ${k.key}`;
      else if (k.key === "Enter" && (k.metaKey || k.ctrlKey) && s.reason) save(`reject (${s.reason})`);
      else if (k.key.length === 1) s.reason += k.key;
    } else if (s.mode === "approve") {
      if (k.key === "a") save("approve");
    } else if (k.key === "a") s.mode = "approve";
    else if (k.key === "r") s.mode = "reject";
    else if (/^[1-6]$/.test(k.key)) s.tab = ["all", "paid", "held", "rejected", "blocked", "pending"][Number(k.key) - 1];
  };
  const q = keyQueue({ gated: () => s.saving || !s.ready, send: handle, frame: (fn) => setTimeout(fn, 16), now: () => Date.now() });
  const press = (key: string) => {
    const k: HeldKey = { key: key.replace(/^Meta\+/, ""), code: "", shiftKey: false, metaKey: key.startsWith("Meta+"), ctrlKey: false, altKey: false };
    if (q.holds()) q.hold(k);
    else handle(k);
  };
  return { s, q, press };
}

describe("keys typed while a decision saves", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each([0, 80, 100, 120, 200])("approve, reject with reason 1, approve at a %ims cadence", async (gap) => {
    const { s, press } = console3();
    for (const k of ["a", "a", "r", "1", "Meta+Enter", "a", "a"]) {
      press(k);
      await vi.advanceTimersByTimeAsync(gap);
    }
    await vi.advanceTimersByTimeAsync(3000);
    expect(s.log).toEqual(["approve RM-5250", "reject (quick 1) RM-8843", "approve RM-9629"]);
    // The 1 was the reject's quick reason, never the All tab.
    expect(s.tab).toBe("held");
  });

  it("lets keys go that waited past KEY_WAIT_MS", async () => {
    const onDrop = vi.fn();
    const q = keyQueue({ gated: () => true, send: vi.fn(), frame: (fn) => setTimeout(fn, 16), now: () => Date.now(), onDrop });
    q.hold({ key: "a", code: "KeyA", shiftKey: false, metaKey: false, ctrlKey: false, altKey: false });
    await vi.advanceTimersByTimeAsync(KEY_WAIT_MS + 100);
    expect(onDrop).toHaveBeenCalledWith(1);
    expect(q.size).toBe(0);
  });

  it("never holds a modifier alone or a browser shortcut", () => {
    const k = (key: string, mod: Partial<HeldKey> = {}) => ({ key, metaKey: false, ctrlKey: false, altKey: false, ...mod });
    expect(holdable(k("a"))).toBe(true);
    expect(holdable(k("Enter", { metaKey: true }))).toBe(true);
    expect(holdable(k("Shift"))).toBe(false);
    expect(holdable(k("r", { metaKey: true }))).toBe(false);
  });
});
