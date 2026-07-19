"use client";

import { Send } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

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
import { cn } from "@/lib/utils";

import {
  buildWaLink,
  renderTemplate,
  TEMPLATE_LABELS,
  type TemplateKey,
  type TemplateVars,
} from "../templates";

type TemplateItem = { key: TemplateKey; text: string };

export function SendWhatsAppSheet({
  clientPhone,
  publicToken,
  templates,
  vars,
  trigger,
}: {
  clientPhone: string;
  publicToken: string;
  templates: TemplateItem[];
  vars: TemplateVars;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TemplateKey>(
    templates[0]?.key ?? "confirmation",
  );
  const [text, setText] = useState("");

  // Si el servidor ya envió el link (con proto https correcto), lo usamos.
  // Si no, lo construimos en el cliente como fallback.
  function fullVars(): TemplateVars {
    if (vars.link) return vars;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return { ...vars, link: `${origin}/cita/${publicToken}` };
  }

  function pick(key: TemplateKey) {
    setSelected(key);
    const tpl = templates.find((t) => t.key === key);
    setText(renderTemplate(tpl?.text ?? "", fullVars()));
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      const first = templates[0];
      if (first) {
        setSelected(first.key);
        setText(renderTemplate(first.text, fullVars()));
      }
    }
  }

  const waHref = useMemo(
    () => buildWaLink(clientPhone, text),
    [clientPhone, text],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Enviar WhatsApp</SheetTitle>
          <SheetDescription>
            Elige una plantilla, ajústala si quieres y se abrirá WhatsApp con el
            mensaje listo.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <Button
                key={t.key}
                type="button"
                size="sm"
                variant={selected === t.key ? "default" : "outline"}
                onClick={() => pick(t.key)}
              >
                {TEMPLATE_LABELS[t.key]}
              </Button>
            ))}
          </div>

          <Textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={cn(text.length > 900 && "border-amber-500")}
          />

          <Button asChild className="w-full" disabled={text.trim() === ""}>
            <a href={waHref} target="_blank" rel="noopener noreferrer">
              <Send className="size-4" />
              Abrir WhatsApp
            </a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
