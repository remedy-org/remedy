import { describe, expect, it } from "vitest";
import { plainError, UNREACHABLE } from "./analyst";

describe("the analyst's errors", () => {
  it("say a request that never reached Remedy in words, and keep every other message", () => {
    expect((plainError(new TypeError("Failed to fetch")) as Error).message).toBe(UNREACHABLE);
    expect((plainError(new Error("NetworkError when attempting to fetch resource.")) as Error).message).toBe(UNREACHABLE);
    const proxy = new Error("The analyst's daily limit was reached.");
    expect(plainError(proxy)).toBe(proxy);
    const abort = new DOMException("The operation was aborted.", "AbortError");
    expect(plainError(abort)).toBe(abort);
  });
});
