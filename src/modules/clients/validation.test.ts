import { describe, expect, it } from "vitest";

import { clientFormSchema } from "./validation";

const base = {
  name: "Susana Gómez",
  phone: "3001234567",
  email: "",
  notes: "",
  birthdayDate: "",
};

describe("clientFormSchema", () => {
  it.each(["3001234567", "+573001234567", "300 123 4567", "57 300 123 4567"])(
    "acepta el celular colombiano %s",
    (phone) => {
      expect(clientFormSchema.safeParse({ ...base, phone }).success).toBe(true);
    },
  );

  it.each(["6012345678", "12025550123", "300123", ""])(
    "rechaza el teléfono inválido %s",
    (phone) => {
      const r = clientFormSchema.safeParse({ ...base, phone });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toMatch(/celular colombiano/i);
      }
    },
  );

  it.each(["+1 202 555 0123", "+1 (202) 555-0123", "+34 612 345 678"])(
    "acepta un celular internacional %s",
    (phone) => {
      expect(clientFormSchema.safeParse({ ...base, phone }).success).toBe(true);
    },
  );

  it("exige nombre de al menos 2 caracteres", () => {
    const r = clientFormSchema.safeParse({ ...base, name: "A" });
    expect(r.success).toBe(false);
  });

  it("acepta email vacío (opcional)", () => {
    expect(clientFormSchema.safeParse({ ...base, email: "" }).success).toBe(
      true,
    );
  });

  it("acepta un email válido", () => {
    expect(
      clientFormSchema.safeParse({ ...base, email: "susana@correo.com" })
        .success,
    ).toBe(true);
  });

  it("rechaza un email con formato inválido", () => {
    const r = clientFormSchema.safeParse({ ...base, email: "no-es-email" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/correo/i);
    }
  });

  it("recorta espacios del nombre", () => {
    const r = clientFormSchema.safeParse({ ...base, name: "  Ana  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("Ana");
  });
});
