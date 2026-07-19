import { Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireTenant } from "@/modules/tenancy/context";
import { MessageTemplateSheet } from "@/modules/whatsapp/components/message-template-sheet";
import { getTemplates } from "@/modules/whatsapp/repository";
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_KEYS,
  TEMPLATE_LABELS,
} from "@/modules/whatsapp/templates";

export const metadata: Metadata = { title: "Mensajes" };

export default async function MensajesPage() {
  const { tenantId } = await requireTenant();
  const templates = await getTemplates(tenantId);

  return (
    <div>
      <Link
        href="/ajustes"
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Ajustes
      </Link>
      <h1 className="mt-3 mb-2 text-2xl font-semibold tracking-tight">
        Mensajes
      </h1>
      <p className="text-muted-foreground mb-5 text-sm">
        Personaliza los textos de WhatsApp que envías a tus clientas.
      </p>

      <ul className="space-y-3">
        {TEMPLATE_KEYS.map((key) => (
          <li key={key} className="rounded-xl border p-3">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-medium">{TEMPLATE_LABELS[key]}</h2>
              <MessageTemplateSheet
                templateKey={key}
                initialText={templates[key]}
                defaultText={DEFAULT_TEMPLATES[key]}
                trigger={
                  <Button variant="ghost" size="sm">
                    <Pencil className="size-4" />
                    Editar
                  </Button>
                }
              />
            </div>
            <p className="text-muted-foreground text-sm whitespace-pre-wrap">
              {templates[key]}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
