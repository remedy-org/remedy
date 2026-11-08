// Keys typed while the evidence panel can't take them yet: a decision saving, or the claim they are meant for still
// loading. They wait, in order, and are replayed one at a time where focus is once the panel is ready, each given two
// frames to land (its render, the focus it moves) before the next. So "A A R 1 ⌘↵ A A" at any speed approves one claim,
// rejects the next with quick reason 1 and approves the one after, as it would typed slowly. Pure: the console supplies
// the gate, the replay and the clock, and the test drives them.

export interface HeldKey {
  key: string;
  code: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

export interface KeyQueueDeps {
  /** True while keys must wait. */
  gated: () => boolean;
  /** Replays one key where focus is now. */
  send: (key: HeldKey) => void;
  /** Runs fn on the next frame. */
  frame: (fn: () => void) => void;
  now: () => number;
  /** The keys waited longer than KEY_WAIT_MS (a save that never came back) and were let go. */
  onDrop?: (count: number) => void;
}

// Longer than any save or claim load the console waits on; past it, keys typed long ago would act by surprise.
export const KEY_WAIT_MS = 8000;

// Keys never held: modifiers alone, and the browser's own shortcuts (only ⌘↵ and Ctrl+↵, the reason's send, are the
// console's).
const MODIFIERS = new Set(["Shift", "Meta", "Control", "Alt", "CapsLock", "Fn"]);
export const holdable = (e: Pick<HeldKey, "key" | "metaKey" | "ctrlKey" | "altKey">) =>
  !MODIFIERS.has(e.key) && (!(e.metaKey || e.ctrlKey || e.altKey) || (e.key === "Enter" && !e.altKey));

export function keyQueue(d: KeyQueueDeps) {
  const keys: HeldKey[] = [];
  let pumping = false;
  let since: number | null = null;
  const pump = () => {
    if (!keys.length) {
      pumping = false;
      since = null;
      return;
    }
    if (d.gated()) {
      since ??= d.now();
      if (d.now() - since > KEY_WAIT_MS) {
        const n = keys.length;
        keys.length = 0;
        pumping = false;
        since = null;
        d.onDrop?.(n);
        return;
      }
      d.frame(pump);
      return;
    }
    since = null;
    d.send(keys.shift()!);
    d.frame(() => d.frame(pump));
  };
  return {
    /** Whether a key pressed now must wait: the panel is busy, or keys pressed before it are still waiting. */
    holds: () => keys.length > 0 || d.gated(),
    hold(key: HeldKey) {
      keys.push(key);
      if (pumping) return;
      pumping = true;
      d.frame(pump);
    },
    clear() {
      keys.length = 0;
    },
    get size() {
      return keys.length;
    },
  };
}
