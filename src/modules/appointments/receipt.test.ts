import { describe, expect, it } from "vitest";

import {
  buildReceiptShareText,
  buildReceiptSvg,
  escapeXml,
  type ReceiptData,
} from "./receipt";

const paid: ReceiptData = {
  variant: "paid",
  businessName: "Uñas & Arte",
  clientName: "Ana <María>",
  dateLabel: "sábado, 12 de julio de 2026",
  timeLabel: "10:00 – 11:00",
  services: [
    { name: "Manicure", quantity: 1, amount: "$50.000" },
    { name: "Esmaltado", quantity: 2, amount: "$40.000" },
  ],
  totalLabel: "$90.000",
  bonusLabel: "$20.000",
  paidLabel: "$90.000",
  saldoLabel: null,
  statusLabel: "Pagada",
  note: null,
};

const cancelled: ReceiptData = {
  ...paid,
  variant: "cancelled",
  statusLabel: "Cancelada",
};

describe("escapeXml", () => {
  it("escapa los caracteres reservados de XML", () => {
    expect(escapeXml(`a & b < c > d " e ' f`)).toBe(
      "a &amp; b &lt; c &gt; d &quot; e &apos; f",
    );
  });
});

describe("buildReceiptSvg", () => {
  it("produce un SVG con dimensiones intrínsecas", () => {
    const svg = buildReceiptSvg(paid);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toMatch(/width="720"/);
    expect(svg).toMatch(/height="\d+"/);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
  });

  it("embebe el icono de marca como data URI en el header", () => {
    const svg = buildReceiptSvg(paid);
    expect(svg).toContain("<image");
    expect(svg).toContain('xlink:href="data:image/png;base64,');
    expect(svg).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
  });

  it("incluye la fecha y la hora de la cita", () => {
    const svg = buildReceiptSvg(paid);
    expect(svg).toContain("sábado, 12 de julio de 2026");
    expect(svg).toContain("10:00 – 11:00");
  });

  it("escapa el nombre de la clienta y del negocio", () => {
    const svg = buildReceiptSvg(paid);
    expect(svg).toContain("Ana &lt;María&gt;");
    expect(svg).toContain("Uñas &amp; Arte");
    // Nunca debe filtrarse un carácter reservado sin escapar en el contenido.
    expect(svg).not.toContain("Ana <María>");
  });

  it("variante pagada: muestra servicios, total, bono y pagado", () => {
    const svg = buildReceiptSvg(paid);
    expect(svg).toContain("Comprobante de cita");
    expect(svg).toContain("SERVICIOS");
    expect(svg).toContain("Manicure");
    expect(svg).toContain("Esmaltado ×2");
    expect(svg).toContain("$90.000");
    expect(svg).toContain("−$20.000");
    expect(svg).toContain("Pagada");
  });

  it("variante cancelada: sin servicios, con aviso y sin cobro", () => {
    const svg = buildReceiptSvg(cancelled);
    expect(svg).toContain("Comprobante de cancelación");
    expect(svg).toContain("Esta cita fue cancelada.");
    expect(svg).toContain("No se realizó ningún cobro.");
    expect(svg).toContain("Cancelada");
    expect(svg).not.toContain("SERVICIOS");
  });

  it("usa la píldora ámbar cuando el estado es un abono (statusTone warning)", () => {
    const svg = buildReceiptSvg({
      ...paid,
      statusLabel: "Abono",
      statusTone: "warning",
      paidLabel: "$40.000",
      saldoLabel: "$30.000",
    });
    expect(svg).toContain("Abono");
    expect(svg).toContain("#fef3c7"); // fondo ámbar de la píldora
    expect(svg).toContain("Saldo");
    expect(svg).toContain("$30.000");
  });

  it("omite saldo y bono cuando son null", () => {
    const svg = buildReceiptSvg({
      ...paid,
      bonusLabel: null,
      saldoLabel: null,
    });
    expect(svg).not.toContain("Bono de cumpleaños");
    expect(svg).not.toContain("Saldo");
  });
});

describe("buildReceiptShareText", () => {
  it("pagada: menciona negocio y total", () => {
    const t = buildReceiptShareText(paid);
    expect(t).toContain("Uñas & Arte");
    expect(t).toContain("$90.000");
  });

  it("cancelada: indica que la cita fue cancelada", () => {
    const t = buildReceiptShareText(cancelled);
    expect(t).toContain("fue cancelada");
    expect(t).toContain("Uñas & Arte");
  });
});
