import { describe, expect, it } from "vitest";

import { detectPlatform } from "./platform";

describe("detectPlatform", () => {
  it("detecta iOS (iPhone / iPad / iPod)", () => {
    expect(
      detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"),
    ).toBe("ios");
    expect(
      detectPlatform("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"),
    ).toBe("ios");
  });
  it("detecta Android", () => {
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe(
      "android",
    );
  });
  it("lo demás es 'other'", () => {
    expect(
      detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"),
    ).toBe("other");
  });
});
