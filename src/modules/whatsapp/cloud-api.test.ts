import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isWhatsAppEnabled, mapMetaErrorCode, sendTemplate } from "./cloud-api";

describe("feature flag", () => {
  it("inerte si faltan las variables", async () => {
    delete process.env.WA_PHONE_NUMBER_ID;
    delete process.env.WA_ACCESS_TOKEN;
    expect(isWhatsAppEnabled()).toBe(false);
    await expect(sendTemplate("+573001112233", "t", [])).rejects.toMatchObject({
      kind: "not_configured",
    });
  });
});

describe("sendTemplate (fetch mockeado)", () => {
  beforeEach(() => {
    process.env.WA_PHONE_NUMBER_ID = "PNID";
    process.env.WA_ACCESS_TOKEN = "TKN";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.WA_PHONE_NUMBER_ID;
    delete process.env.WA_ACCESS_TOKEN;
  });

  it("arma el payload correcto y devuelve el wa_message_id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.ABC" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const id = await sendTemplate("+57 300 111 2233", "recordatorio", [
      "Ana",
      "mañana 3pm",
    ]);
    expect(id).toBe("wamid.ABC");

    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/PNID/messages");
    expect((opts.headers as Record<string, string>).Authorization).toBe(
      "Bearer TKN",
    );
    const body = JSON.parse(opts.body as string);
    expect(body.messaging_product).toBe("whatsapp");
    expect(body.to).toBe("573001112233"); // solo dígitos
    expect(body.template.name).toBe("recordatorio");
    expect(body.template.language.code).toBe("es");
    expect(body.template.components[0].parameters).toEqual([
      { type: "text", text: "Ana" },
      { type: "text", text: "mañana 3pm" },
    ]);
  });

  it("sin variables no envía components", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.X" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await sendTemplate("+573001112233", "saludo");
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.template.components).toBeUndefined();
  });

  it("mapea los errores de Meta a tipos seguros", async () => {
    const withCode = (code: number) =>
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          json: async () => ({ error: { code, message: "x" } }),
        }),
      );

    withCode(132001);
    await expect(sendTemplate("+57300", "t")).rejects.toMatchObject({
      kind: "template_not_approved",
    });
    withCode(131026);
    await expect(sendTemplate("+57300", "t")).rejects.toMatchObject({
      kind: "invalid_number",
    });
    withCode(80007);
    await expect(sendTemplate("+57300", "t")).rejects.toMatchObject({
      kind: "rate_limit",
    });
    withCode(999999);
    await expect(sendTemplate("+57300", "t")).rejects.toMatchObject({
      kind: "unknown",
    });
  });
});

describe("mapMetaErrorCode", () => {
  it("clasifica códigos conocidos", () => {
    expect(mapMetaErrorCode(132005)).toBe("template_not_approved");
    expect(mapMetaErrorCode(131026)).toBe("invalid_number");
    expect(mapMetaErrorCode(130429)).toBe("rate_limit");
    expect(mapMetaErrorCode(undefined)).toBe("unknown");
  });
});
