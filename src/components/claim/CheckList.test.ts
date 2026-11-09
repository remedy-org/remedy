import { describe, expect, it } from "vitest";
import { sixRows } from "./CheckList";
import type { CheckRow } from "./model";

// The owner's five checks: always five rows (the list never shrinks between claims), one fixed line per outcome in
// Remedy's words, the same on a demo claim as on a real one.

const pre = (account: CheckRow["state"], detail?: string): CheckRow[] => [
  { id: "session", group: "pre", label: "", state: "pass" },
  { id: "duplicate_photo", group: "pre", label: "", state: "pass" },
  { id: "account", group: "pre", label: "", state: account, detail },
];
const model = (step: CheckRow["state"]): CheckRow[] => [
  { id: "label", group: "model", label: "", state: "pass", quote: 'The tag reads "X-VESOLJE".' },
  { id: "code", group: "model", label: "", state: "pass", quote: 'The code reads "M4T".' },
  { id: "step_1", group: "model", label: "", state: step, quote: "The pillow is visibly separated into two pieces, with exposed white filling.", detail: step === "pass" ? undefined : "Couldn't confirm: cut" },
  { id: "screen", group: "model", label: "", state: "pass" },
];
const base = { code: "M4T", noun: "Pillow", cut: true, decided: true, written: "X-VESOLJE" };

describe("sixRows", () => {
  it("keeps the account row on a demo claim that skips it, with why", () => {
    const rows = sixRows([...pre("skipped"), ...model("pass")], { ...base, demo: true }).filter((r) => r.key !== "refund");
    expect(rows).toHaveLength(5);
    const account = rows.find((r) => r.key === "account")!;
    expect(account.state).toBe("skipped");
    expect(account.unrun).toBeFalsy();
    expect(account.detail).toBe("Counted once, on your genuine claim.");
  });

  it("words a demo claim's passes as a real claim's, with no test-run language", () => {
    for (const demo of [true, false]) {
      const rows = sixRows([...pre("pass"), ...model("pass")], { ...base, demo });
      expect(rows.find((r) => r.key === "duplicate")!.because).toBe("No earlier claim has this photo.");
      expect(rows.find((r) => r.key === "account")!.because).toBe("No other claim from this PayPal account.");
      expect(rows.map((r) => `${r.because ?? ""} ${r.detail ?? ""}`).join(" ")).not.toMatch(/this run|all four/);
    }
  });

  it("names each word it couldn't read on a held tag, and marks them as data for mono", () => {
    const unsure: CheckRow[] = [
      { id: "label", group: "model", label: "", state: "hold" },
      { id: "code", group: "model", label: "", state: "hold" },
      { id: "step_1", group: "model", label: "", state: "pass" },
    ];
    const code = sixRows([...pre("pass"), ...unsure], { ...base, code: "H9D", held: true }).find((r) => r.key === "code")!;
    expect(code.detail).toBe("We couldn’t read X-VESOLJE or H9D on your paper tag.");
    expect(code.marks).toEqual(["X-VESOLJE", "H9D"]);
    // On the held result the lead says it: the row says who looks instead, with nothing left to set in mono.
    const explained = sixRows([...pre("pass"), ...unsure], { ...base, code: "H9D", held: true, explained: true, company: "Kikea Store" }).find((r) => r.key === "code")!;
    expect([explained.detail, explained.marks]).toEqual(["A person at Kikea Store will look at this.", undefined]);
  });

  it("says the session check passed without repeating its name", () => {
    const session = sixRows([...pre("pass"), ...model("pass")], base).find((r) => r.key === "session")!;
    expect(session.because).toBe("Arrived from this page, inside the code’s 10 minutes.");
  });

  it("gives the cut a fixed line, never the photo check's sentence", () => {
    const pass = sixRows([...pre("pass"), ...model("pass")], base).find((r) => r.key === "destroyed")!;
    expect(pass.because).toBe("Both halves and the cut are in the photo.");
    const fail = sixRows([...pre("pass"), ...model("reject")], { ...base, explained: true }).find((r) => r.key === "destroyed")!;
    expect(fail.detail).toBe("We couldn’t see the pillow cut in half.");
  });

  it("names the checks as the homepage and the console do", () => {
    const names = sixRows([...pre("pass"), ...model("pass")], base).map((r) => r.name);
    expect(names.slice(0, 5)).toEqual(["sent in the camera session", "photo not used before", "one claim per verified PayPal account", "tag shows X-VESOLJE and M4T", "pillow cut in half"]);
  });

  it("says why a check that never ran didn't, so the row keeps its line", () => {
    const blocked: CheckRow[] = [
      { id: "session", group: "pre", label: "", state: "blocked", detail: "This photo wasn't sent in this claim's camera session" },
      { id: "duplicate_photo", group: "pre", label: "", state: "pass" },
      { id: "account", group: "pre", label: "", state: "pass" },
    ];
    const rows = sixRows(blocked, base);
    expect(rows.find((r) => r.key === "session")!.detail).toBe("This photo came from outside the claim’s camera session.");
    const code = rows.find((r) => r.key === "code")!;
    expect(code.unrun).toBe(true);
    expect(code.detail).toBe("Not run: this photo wasn’t sent in this claim’s camera session.");
  });

  it("marks the wrong characters of a code the tag shows", () => {
    const wrong: CheckRow[] = [
      ...pre("pass"),
      { id: "label", group: "model", label: "", state: "pass", quote: 'The tag reads "X-VESOLJE K7Q".' },
      { id: "code", group: "model", label: "", state: "reject", quote: 'The code reads "K7Q".' },
      { id: "step_1", group: "model", label: "", state: "pass" },
    ];
    const code = sixRows(wrong, { ...base, code: "K7P" }).find((r) => r.key === "code")!;
    expect(code.read).toEqual({ label: "X-VESOLJE", code: "K7Q", off: [2] });
  });
});
