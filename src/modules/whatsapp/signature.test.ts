import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifyWebhookSignature } from "./signature";

const SECRET = "app-secret-de-prueba";
const BODY = '{"object":"whatsapp_business_account","entry":[]}';
const validSig =
  "sha256=" + createHmac("sha256", SECRET).update(BODY, "utf8").digest("hex");

describe("verifyWebhookSignature", () => {
  it("acepta una firma válida", () => {
    expect(verifyWebhookSignature(BODY, validSig, SECRET)).toBe(true);
  });
  it("rechaza una firma con el cuerpo alterado", () => {
    expect(verifyWebhookSignature(BODY + " ", validSig, SECRET)).toBe(false);
  });
  it("rechaza con el secreto equivocado", () => {
    expect(verifyWebhookSignature(BODY, validSig, "otro-secreto")).toBe(false);
  });
  it("rechaza firma ausente o con formato inválido", () => {
    expect(verifyWebhookSignature(BODY, null, SECRET)).toBe(false);
    expect(verifyWebhookSignature(BODY, "abc123", SECRET)).toBe(false);
  });
});
