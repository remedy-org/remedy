import { describe, expect, it } from "vitest";
import { askedSample, sampleLinkName } from "./samples";

describe("a /try link's demo claim", () => {
  it("reads the plain name, and the older sample id as an alias", () => {
    expect(askedSample({ claim: "web-photo" })).toBe("ai-no-session");
    expect(askedSample({ sample: "ai-no-session" })).toBe("ai-no-session");
    expect(askedSample({ claim: sampleLinkName("wrong-code") })).toBe("wrong-code");
  });

  it("ignores a name it doesn't know", () => {
    expect(askedSample({ claim: "ai-no-session" })).toBeNull();
    expect(askedSample({ sample: "web-photo" })).toBeNull();
    expect(askedSample({})).toBeNull();
  });
});
