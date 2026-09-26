import { describe, expect, it } from "vitest";

import { isOfflinePagePath } from "./constants";
import { buildOfflineUrls } from "./urls";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("buildOfflineUrls", () => {
  it("incluye 8 días de agenda, vistas, clientas y detalles sin repetir clientas", () => {
    const urls = buildOfflineUrls("2026-09-25", [
      { id: A, clientId: C },
      { id: B, clientId: C },
    ]);
    expect(urls).toContain("/citas?date=2026-09-25");
    expect(urls).toContain("/citas?date=2026-10-02");
    expect(urls).not.toContain("/citas?date=2026-10-03");
    expect(urls).toContain("/citas?view=pendientes");
    expect(urls).toContain("/clientas");
    expect(urls).toContain(`/citas/${A}`);
    expect(urls).toContain(`/citas/${B}`);
    expect(urls.filter((u) => u === `/clientas/${C}`)).toHaveLength(1);
  });

  it("todas las URLs caen dentro del perímetro offline del SW", () => {
    const urls = buildOfflineUrls("2026-09-25", [{ id: A, clientId: C }]);
    for (const u of urls) {
      expect(isOfflinePagePath(new URL(u, "https://x").pathname)).toBe(true);
    }
  });
});
