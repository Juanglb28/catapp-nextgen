/**
 * Comprobante de cita como imagen (SVG puro, sin dependencias).
 *
 * Se genera en el navegador de la manicurista y se comparte por WhatsApp
 * (ver `components/receipt-button.tsx`). La imagen la conserva la clienta,
 * ya que la vista pública de la cita queda cerrada al pagar/cancelar.
 *
 * Se usa SVG nativo (no `foreignObject`/HTML) para que rasterice de forma
 * confiable en canvas en todos los navegadores. Todo el texto dinámico se
 * escapa para XML. Alineado con D-15 (gráficos SVG propios, sin librerías).
 */

import { RECEIPT_ICON_DATA_URI } from "./receipt-icon";

export type ReceiptService = {
  name: string;
  quantity: number;
  /** Monto ya formateado (es-CO), p. ej. "$50.000". */
  amount: string;
};

export type ReceiptData = {
  variant: "paid" | "cancelled";
  businessName: string;
  clientName: string;
  /** Fecha larga ya formateada en la TZ del tenant. */
  dateLabel: string;
  /** "10:00 – 11:00" ya formateado. */
  timeLabel: string;
  services: ReceiptService[];
  /**
   * Desglose por persona cuando la cita tuvo más de una (D-38). Si se omite
   * o viene vacío (citas creadas antes de este cambio, sin nombres
   * guardados), el comprobante se ve igual que antes: solo la lista plana
   * de `services`. Cuando viene con datos, se renderiza agrupado por
   * persona EN LUGAR de la lista plana, para no duplicar los servicios.
   */
  people?: {
    name: string;
    services: ReceiptService[];
    /** Subtotal ya formateado de la persona (D-40). Si se omite, no se dibuja. */
    subtotal?: string;
  }[];
  /** Montos ya formateados (es-CO). Los `*Label` opcionales se omiten si null. */
  totalLabel: string;
  bonusLabel: string | null;
  paidLabel: string | null;
  saldoLabel: string | null;
  /** Propina cobrada, ya formateada (es-CO). Se omite si null/ausente. */
  tipLabel?: string | null;
  /** Método de pago legible (Efectivo / Transferencia / Efectivo y transferencia). */
  methodLabel?: string | null;
  /** "Pagada" | "Cancelada" | "Abono". */
  statusLabel: string;
  /**
   * Color de la píldora de estado. Si se omite, se deriva de `variant`
   * (cancelada = rojo, resto = verde). `warning` (ámbar) para abonos.
   */
  statusTone?: "success" | "cancelled" | "warning";
  /** Nota opcional al pie. */
  note: string | null;
};

const FONT = "Arial, Helvetica, sans-serif";
const W = 720;
const M = 48;
const RIGHT = W - M;

const COLOR = {
  text: "#0f172a",
  muted: "#64748b",
  divider: "#e2e8f0",
  green: "#15803d",
  amber: "#b45309",
  pink: "#be185d",
};

/** Escapa texto para incrustarlo en XML/SVG de forma segura. */
export function escapeXml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&apos;",
        '"': "&quot;",
      })[c] ?? c,
  );
}

type TextOpts = {
  size?: number;
  weight?: number;
  color?: string;
  anchor?: "start" | "middle" | "end";
};

function text(
  x: number,
  y: number,
  value: string,
  opts: TextOpts = {},
): string {
  const {
    size = 22,
    weight = 400,
    color = COLOR.text,
    anchor = "start",
  } = opts;
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${escapeXml(value)}</text>`;
}

function divider(y: number): string {
  return `<line x1="${M}" y1="${y}" x2="${RIGHT}" y2="${y}" stroke="${COLOR.divider}" stroke-width="1"/>`;
}

type StatusTone = NonNullable<ReceiptData["statusTone"]>;

const PILL_COLORS: Record<StatusTone, { bg: string; fg: string }> = {
  success: { bg: "#dcfce7", fg: "#15803d" },
  cancelled: { bg: "#fee2e2", fg: "#b91c1c" },
  warning: { bg: "#fef3c7", fg: "#b45309" },
};

/** Píldora de estado (fondo redondeado + texto), alineada a la derecha. */
function statusPill(y: number, label: string, tone: StatusTone): string {
  const { bg, fg } = PILL_COLORS[tone];
  const padX = 16;
  const w = Math.round(label.length * 10.5) + padX * 2;
  const h = 32;
  const x = RIGHT - w;
  return (
    `<rect x="${x}" y="${y - h + 8}" width="${w}" height="${h}" rx="16" fill="${bg}"/>` +
    text(x + w / 2, y, label, {
      size: 17,
      weight: 700,
      color: fg,
      anchor: "middle",
    })
  );
}

/**
 * Construye el SVG del comprobante. Devuelve un documento SVG con `width`/
 * `height` en px para que rasterice con dimensiones intrínsecas en canvas.
 */
export function buildReceiptSvg(data: ReceiptData): string {
  const body: string[] = [];

  // Header con gradiente de marca (Ocean Gradient, D-13).
  const headerH = 150;
  const iconSize = 120;
  body.push(
    `<rect x="0" y="0" width="${W}" height="${headerH}" fill="url(#brand)"/>`,
    `<circle cx="${M + 24}" cy="75" r="24" fill="#ffffff"/>`,
    text(M + 24, 82, "CA", {
      size: 22,
      weight: 800,
      color: "#0891B2",
      anchor: "middle",
    }),
    text(M + 64, 66, data.businessName, {
      size: 26,
      weight: 700,
      color: "#ffffff",
    }),
    text(
      M + 64,
      98,
      data.variant === "cancelled"
        ? "Comprobante de cancelación"
        : "Comprobante de cita",
      { size: 16, color: "#eaf7f4" },
    ),
    // Icono de marca (CatApp), arriba a la derecha. Embebido como data URI
    // para que rasterice en canvas sin invalidar la exportación.
    `<image xlink:href="${RECEIPT_ICON_DATA_URI}" x="${RIGHT - iconSize}" y="${
      (headerH - iconSize) / 2
    }" width="${iconSize}" height="${iconSize}" preserveAspectRatio="xMidYMid meet"/>`,
  );

  let y = headerH + 56;

  // Nombre de la clienta + píldora de estado.
  body.push(text(M, y, data.clientName, { size: 30, weight: 700 }));
  const tone: StatusTone =
    data.statusTone ?? (data.variant === "cancelled" ? "cancelled" : "success");
  body.push(statusPill(y, data.statusLabel, tone));
  y += 50;

  // Fecha y hora.
  body.push(text(M, y, data.dateLabel, { size: 22, weight: 600 }));
  y += 30;
  body.push(text(M, y, data.timeLabel, { size: 18, color: COLOR.muted }));
  y += 26;

  body.push(divider(y));
  y += 4;

  if (data.variant === "cancelled") {
    y += 44;
    body.push(
      text(M, y, "Esta cita fue cancelada.", { size: 20, weight: 600 }),
    );
    y += 30;
    body.push(
      text(M, y, "No se realizó ningún cobro.", {
        size: 18,
        color: COLOR.muted,
      }),
    );
    y += 20;
  } else {
    // Servicios: desglosados por persona si hay más de una (D-38), si no
    // la lista plana de siempre. Nunca se muestran ambos a la vez.
    if (data.people && data.people.length > 0) {
      y += 38;
      for (const person of data.people) {
        body.push(
          text(M, y, person.name.toUpperCase(), {
            size: 13,
            weight: 700,
            color: COLOR.muted,
          }),
        );
        for (const s of person.services) {
          y += 34;
          const name = s.quantity > 1 ? `${s.name} ×${s.quantity}` : s.name;
          body.push(text(M + 12, y, name, { size: 20 }));
          body.push(
            text(RIGHT, y, s.amount, { size: 20, weight: 600, anchor: "end" }),
          );
        }
        if (person.subtotal) {
          y += 32;
          body.push(
            text(M + 12, y, "Subtotal", {
              size: 18,
              weight: 700,
              color: COLOR.muted,
            }),
          );
          body.push(
            text(RIGHT, y, person.subtotal, {
              size: 20,
              weight: 700,
              anchor: "end",
            }),
          );
        }
        y += 38;
      }
      y -= 18;
      body.push(divider(y));
    } else if (data.services.length > 0) {
      y += 38;
      body.push(
        text(M, y, "SERVICIOS", { size: 13, weight: 700, color: COLOR.muted }),
      );
      for (const s of data.services) {
        y += 34;
        const name = s.quantity > 1 ? `${s.name} ×${s.quantity}` : s.name;
        body.push(text(M, y, name, { size: 20 }));
        body.push(
          text(RIGHT, y, s.amount, { size: 20, weight: 600, anchor: "end" }),
        );
      }
      y += 20;
      body.push(divider(y));
    }

    // Totales.
    y += 40;
    body.push(text(M, y, "Total", { size: 18, color: COLOR.muted }));
    body.push(
      text(RIGHT, y, data.totalLabel, { size: 22, weight: 700, anchor: "end" }),
    );

    if (data.bonusLabel) {
      y += 34;
      body.push(
        text(M, y, "Bono de cumpleaños", { size: 18, color: COLOR.muted }),
      );
      body.push(
        text(RIGHT, y, `−${data.bonusLabel}`, {
          size: 18,
          weight: 600,
          color: COLOR.pink,
          anchor: "end",
        }),
      );
    }

    if (data.paidLabel) {
      y += 34;
      body.push(text(M, y, "Pagado", { size: 18, color: COLOR.muted }));
      body.push(
        text(RIGHT, y, data.paidLabel, {
          size: 18,
          weight: 600,
          color: COLOR.green,
          anchor: "end",
        }),
      );
    }

    if (data.saldoLabel) {
      y += 34;
      body.push(text(M, y, "Saldo", { size: 18, color: COLOR.muted }));
      body.push(
        text(RIGHT, y, data.saldoLabel, {
          size: 18,
          weight: 600,
          color: COLOR.amber,
          anchor: "end",
        }),
      );
    }

    // Propina (si aplica).
    if (data.tipLabel) {
      y += 34;
      body.push(text(M, y, "Propina", { size: 18, color: COLOR.muted }));
      body.push(
        text(RIGHT, y, data.tipLabel, {
          size: 18,
          weight: 600,
          color: COLOR.green,
          anchor: "end",
        }),
      );
    }

    // Método de pago (si aplica).
    if (data.methodLabel) {
      y += 34;
      body.push(text(M, y, "Método de pago", { size: 18, color: COLOR.muted }));
      body.push(
        text(RIGHT, y, data.methodLabel, {
          size: 18,
          weight: 600,
          anchor: "end",
        }),
      );
    }
    y += 24;
  }

  // Nota opcional del negocio.
  if (data.note) {
    y += 30;
    body.push(text(M, y, data.note, { size: 16, color: COLOR.muted }));
    y += 10;
  }

  // Pie.
  y += 54;
  body.push(divider(y - 30));
  body.push(
    text(W / 2, y, "Hecho con CatApp", {
      size: 14,
      color: COLOR.muted,
      anchor: "middle",
    }),
  );

  const height = y + 40;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}">` +
    `<defs><linearGradient id="brand" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="#10B981"/><stop offset="1" stop-color="#0EA5E9"/>` +
    `</linearGradient></defs>` +
    `<rect x="0" y="0" width="${W}" height="${height}" fill="#ffffff"/>` +
    body.join("") +
    `</svg>`
  );
}

/** Texto que acompaña al comprobante al compartirlo por WhatsApp. */
export function buildReceiptShareText(data: ReceiptData): string {
  if (data.variant === "cancelled") {
    return `Tu cita en ${data.businessName} del ${data.dateLabel} fue cancelada. Adjunto el comprobante.`;
  }
  return `¡Gracias por tu visita! Comprobante de tu cita en ${data.businessName} (${data.dateLabel}). Total: ${data.totalLabel}.`;
}
