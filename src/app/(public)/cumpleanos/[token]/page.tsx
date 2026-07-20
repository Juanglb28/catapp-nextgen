import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublicBonusAction } from "@/modules/birthdays/actions";
import { BirthdayChoiceForm } from "./birthday-choice-form";

export const metadata: Metadata = {
  title: "¡Feliz cumpleaños! 🎂",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PublicCumpleanosPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getPublicBonusAction(token);

  if (!result.ok) notFound();

  const { status, clientName, chosenOption, businessName, options } =
    result.data;

  // Bono no válido para elegir
  if (status === "pending_manicurist" || status === "declined") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-5xl">🎂</span>
        <h1 className="text-xl font-semibold">
          ¡Feliz cumpleaños, {clientName}!
        </h1>
        <p className="text-muted-foreground max-w-[30ch] text-sm">
          Tu regalo está siendo preparado. Tu manicurista te contactará pronto.
        </p>
      </div>
    );
  }

  // Ya eligió — chosenOption ya es la etiqueta (snapshot) (B1.1).
  if (status === "chosen" || status === "redeemed") {
    const label = chosenOption;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-5xl">🎉</span>
        <h1 className="text-xl font-semibold">
          ¡Tu regalo está listo, {clientName}!
        </h1>
        <p className="text-sm">
          Elegiste: <span className="font-semibold text-pink-700">{label}</span>
        </p>
        <p className="text-muted-foreground max-w-[32ch] text-sm">
          Redimible en el mes de tu cumpleaños. Preséntalo en tu próxima cita.
          💅
        </p>
        <p className="text-muted-foreground text-xs">— {businessName}</p>
      </div>
    );
  }

  // Aprobado pero el negocio no tiene opciones activas todavía.
  if (options.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-5xl">🎂</span>
        <h1 className="text-xl font-semibold">
          ¡Feliz cumpleaños, {clientName}!
        </h1>
        <p className="text-muted-foreground max-w-[30ch] text-sm">
          Tu regalo está siendo preparado. Tu manicurista te contactará pronto.
        </p>
        <p className="text-muted-foreground text-xs">— {businessName}</p>
      </div>
    );
  }

  // status === 'approved' → puede elegir
  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-4 py-8">
      <div className="space-y-2 text-center">
        <span className="text-5xl">🎂</span>
        <h1 className="text-2xl font-bold">¡Feliz cumpleaños, {clientName}!</h1>
        <p className="text-muted-foreground text-sm">
          {businessName} quiere hacerte un regalo especial. Elige tu servicio
          gratis:
        </p>
      </div>

      <BirthdayChoiceForm token={token} options={options} />

      <p className="text-muted-foreground max-w-[34ch] text-center text-xs">
        Redimible durante el mes de tu cumpleaños en tu próxima cita.
      </p>
    </div>
  );
}
