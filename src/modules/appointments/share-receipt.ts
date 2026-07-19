import { buildWaLink } from "@/modules/whatsapp/templates";

import {
  buildReceiptShareText,
  buildReceiptSvg,
  type ReceiptData,
} from "./receipt";

/** Rasteriza un SVG a PNG (Blob) en el navegador vía canvas. */
async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("No se pudo cargar el SVG."));
      img.src = url;
    });

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas no disponible.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("No se pudo exportar."))),
        "image/png",
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type ShareResult = "shared" | "downloaded";

/**
 * Genera el comprobante como imagen PNG y lo comparte por WhatsApp con
 * `caption` como texto adjunto (debajo de la imagen).
 * - Con Web Share (archivos): abre la hoja nativa → WhatsApp → clienta.
 * - Sin soporte: descarga el PNG y abre wa.me con el texto para adjuntarlo.
 *
 * `caption` por defecto usa el texto genérico del comprobante. Devuelve si se
 * compartió nativamente o si se descargó (fallback). Lanza si falla la
 * generación de la imagen.
 */
export async function shareReceipt(
  data: ReceiptData,
  phone: string,
  caption?: string,
): Promise<ShareResult> {
  const text = caption ?? buildReceiptShareText(data);
  const png = await svgToPng(buildReceiptSvg(data));
  const file = new File([png], "comprobante.png", { type: "image/png" });

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };

  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Comprobante", text });
      return "shared";
    } catch (err) {
      // El usuario canceló la hoja de compartir: no es un error.
      if ((err as Error).name === "AbortError") return "shared";
      // Cualquier otro fallo (p. ej. activación perdida): usa el fallback.
    }
  }

  downloadBlob(png, "comprobante.png");
  window.open(buildWaLink(phone, text), "_blank");
  return "downloaded";
}
