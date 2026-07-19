"use client";

import { FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { type ReceiptData } from "../receipt";
import { shareReceipt } from "../share-receipt";

/**
 * Genera el comprobante como imagen y lo comparte por WhatsApp.
 * `caption` es el texto que se adjunta debajo de la imagen (opcional).
 */
export function ReceiptButton({
  data,
  phone,
  caption,
}: {
  data: ReceiptData;
  phone: string;
  caption?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const result = await shareReceipt(data, phone, caption);
      if (result === "downloaded") {
        toast.success("Comprobante descargado. Adjúntalo en WhatsApp.");
      }
    } catch {
      toast.error("No se pudo generar el comprobante.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={run} disabled={loading}>
      <FileText className="size-4" aria-hidden />
      {loading ? "Generando…" : "Enviar comprobante"}
    </Button>
  );
}
