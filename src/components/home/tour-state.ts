// The console tour's steps as data (ConsoleTour.tsx plays them; tour-state.test.ts checks the rules): which console
// page the frame's chrome underlines, which body shows, what the claims grid filters to and opens, where the arriving
// claim is, and the step's one amber subject (DESIGN.md: one amber per viewport).

export type Step = 0 | 1 | 2 | 3;
export const STEPS: Step[] = [0, 1, 2, 3];

export interface StepState {
  /** The in-frame chrome's underlined page. */
  page: "claims" | "insights" | "report";
  /** The body in the frame's fixed slot: 01 and 02 share the claims grid. */
  body: "claims" | "insights" | "report";
  filter: "held" | null;
  /** The claim whose row is selected and whose evidence is docked. */
  openId: string | null;
  /** Where the arriving claim is (step 01 only; elsewhere it is simply in the queue). */
  arrival: "before" | "final";
  /** The step's one amber element, if any: the open row's edge on 02. */
  amber: string | null;
}

export interface StepContext {
  /** The held claim step 02 opens. */
  openId: string;
  /** prefers-reduced-motion: every step is shown in its final state, at once. */
  reduced?: boolean;
}

/**
 * A step's state at a moment: "start" is where its motion begins (the claim not yet arrived, the held claim not yet
 * open), "final" where it rests. Under reduced motion the start is the final state.
 */
export function stateAt(step: Step, at: "start" | "final", { openId, reduced = false }: StepContext): StepState {
  const final = at === "final" || reduced;
  switch (step) {
    case 0:
      return { page: "claims", body: "claims", filter: null, openId: null, arrival: final ? "final" : "before", amber: null };
    case 1:
      return {
        page: "claims",
        body: "claims",
        filter: "held",
        openId: final ? openId : null,
        arrival: "final",
        amber: final ? `${openId} row` : null,
      };
    case 2:
      return { page: "insights", body: "insights", filter: null, openId: null, arrival: "final", amber: null };
    case 3:
      return { page: "report", body: "report", filter: null, openId: null, arrival: "final", amber: null };
  }
}

/** The next tab for a key in the tablist (←/→ wrap, Home/End jump), or null for any other key. */
export function nextTab(key: string, at: Step): Step | null {
  const n = STEPS.length;
  const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: n - 1 }[key];
  return to === undefined ? null : (((to % n) + n) % n as Step);
}
