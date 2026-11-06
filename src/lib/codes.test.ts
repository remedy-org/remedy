import { describe, expect, it } from "vitest";
import { CODE_PATTERN, newCode } from "./codes";

describe("newCode", () => {
  const codes = Array.from({ length: 2000 }, newCode);

  it("is letter-digit-letter from the safe alphabet", () => {
    for (const c of codes) expect(c).toMatch(CODE_PATTERN);
  });

  it("never uses a look-alike character", () => {
    expect(codes.join("")).not.toMatch(/[O0QI1L8B5S2Z]/);
  });

  it("is random", () => {
    expect(new Set(codes).size).toBeGreaterThan(1000);
  });
});
