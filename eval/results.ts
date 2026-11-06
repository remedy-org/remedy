import type { Outcome, Verdict } from "../src/lib/types";

// One answer compared with the case's key. towardPaying: the model gave the answer that moves money, and it was wrong.
export interface Field {
  field: string;
  want: string[];
  got: string | undefined;
  ok: boolean;
  towardPaying: boolean;
}

export interface Row {
  case: string;
  expect: Outcome[];
  decision: Outcome | "error";
  ok: boolean;
  fakePaid?: boolean;
  fields: Field[];
  note?: string;
  model?: string;
  seconds?: number;
  usage?: unknown;
  verdict?: Verdict;
  error?: string;
}

// What eval/run.ts writes to --out, and eval/summarize.ts reads back.
export interface RunFile {
  model: string;
  effort: string;
  spec: string;
  tokens: { in: number; out: number };
  rows: Row[];
}
