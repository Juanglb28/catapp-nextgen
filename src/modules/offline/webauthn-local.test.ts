import { describe, expect, it } from "vitest";

import { isUserVerified } from "./webauthn-local";

function authData(flags: number): ArrayBuffer {
  const b = new Uint8Array(37);
  b[32] = flags;
  return b.buffer;
}

describe("isUserVerified", () => {
  it("exige la bandera UV (0x04)", () => {
    expect(isUserVerified(authData(0x05))).toBe(true); // UP + UV
    expect(isUserVerified(authData(0x01))).toBe(false); // solo UP
    expect(isUserVerified(new ArrayBuffer(10))).toBe(false);
  });
});
