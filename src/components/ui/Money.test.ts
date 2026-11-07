import { describe, expect, it } from "vitest";
import { splitMoney } from "./Money";

describe("splitMoney", () => {
  it("splits dollars from cents", () => {
    expect(splitMoney(29.99)).toEqual({ whole: "$29", cents: ".99", full: "$29.99" });
  });

  it("groups thousands and pads cents", () => {
    expect(splitMoney(1234.5)).toEqual({ whole: "$1,234", cents: ".50", full: "$1,234.50" });
  });

  it("rounds to the cent", () => {
    expect(splitMoney(29.996).full).toBe("$30.00");
    expect(splitMoney(0)).toEqual({ whole: "$0", cents: ".00", full: "$0.00" });
  });

  it("keeps a currency without cents whole", () => {
    expect(splitMoney(1500, "JPY")).toEqual({ whole: "¥1,500", cents: "", full: "¥1,500" });
  });
});
