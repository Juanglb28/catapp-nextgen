"use client";

import { type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

import { saveMessageTemplateAction } from "../actions";
import {
  TEMPLATE_LABELS,
  TEMPLATE_PLACEHOLDERS,
  type TemplateKey,
} from "../templates";

export function MessageTemplateSheet({
  templateKey,
  initialText,
  defaultText,
  trigger,
}: {
  templateKey: TemplateKey;
  initialText: string;
  defaultText: string;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setText(initialText);
      setError(null);
    }
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    const result = await saveMessageTemplateAction({ key: templateKey, text });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    toast.success("Mensaje guardado");
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{TEMPLATE_LABELS[templateKey]}</SheetTitle>
          <SheetDescription>
            Usa estos campos entre llaves; se reemplazan automáticamente al
            enviar.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <div className="flex flex-wrap gap-1">
            {TEMPLATE_PLACEHOLDERS.map((p) => (
              <code
                key={p}
                className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs"
              >
                {p}
              </code>
            ))}
          </div>

          <Textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <button
            type="button"
            onClick={() => setText(defaultText)}
            className="text-muted-foreground text-xs hover:underline"
          >
            Restaurar texto por defecto
          </button>

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}

          <Button className="w-full" disabled={submitting} onClick={submit}>
            {submitting ? "Guardando…" : "Guardar mensaje"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
