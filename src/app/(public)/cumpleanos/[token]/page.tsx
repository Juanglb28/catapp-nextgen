import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublicBonusAction } from "@/modules/birthdays/actions";
import { BirthdayChoiceForm } from "./birthday-choice-form";
import { GiftReveal } from "./gift-reveal";

export const metadata: Metadata = {
  title: "¡Feliz cumpleaños! 🎂",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Fondo morado/rosa oscuro exclusivo de esta pantalla pública (D-30): la
 * clienta nunca ve el resto de la app, así que este look es fijo y no
 * depende del tema/paleta del negocio (B6). `fixed inset-0` cubre el
 * viewport completo aunque el layout público limite el contenido a
 * `max-w-md`.
 */
function GiftBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 bg-gradient-to-b from-[#1b0e33] via-[#3a1264] to-[#5b1a6b]"
    />
  );
}

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
      <>
        <GiftBackground />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-white">
          <span className="text-5xl">🎂</span>
          <h1 className="text-xl font-semibold">
            ¡Feliz cumpleaños, {clientName}!
          </h1>
          <p className="max-w-[30ch] text-sm text-white/70">
            Tu regalo está siendo preparado. Tu manicurista te contactará
            pronto.
          </p>
        </div>
      </>
    );
  }

  // Ya eligió — chosenOption ya es la etiqueta (snapshot) (B1.1).
  if (status === "chosen" || status === "redeemed") {
    const label = chosenOption;
    return (
      <>
        <GiftBackground />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-white">
          <span className="text-5xl">🎉</span>
          <h1 className="text-xl font-semibold">
            ¡Tu regalo está listo, {clientName}!
          </h1>
          <p className="text-sm">
            Elegiste:{" "}
            <span className="font-semibold text-pink-300">{label}</span>
          </p>
          <p className="max-w-[32ch] text-sm text-white/70">
            Redimible en el mes de tu cumpleaños. Preséntalo en tu próxima cita.
            💅
          </p>
          <p className="text-xs text-white/50">— {businessName}</p>
        </div>
      </>
    );
  }

  // Aprobado pero el negocio no tiene opciones activas todavía.
  if (options.length === 0) {
    return (
      <>
        <GiftBackground />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-white">
          <span className="text-5xl">🎂</span>
          <h1 className="text-xl font-semibold">
            ¡Feliz cumpleaños, {clientName}!
          </h1>
          <p className="max-w-[30ch] text-sm text-white/70">
            Tu regalo está siendo preparado. Tu manicurista te contactará
            pronto.
          </p>
          <p className="text-xs text-white/50">— {businessName}</p>
        </div>
      </>
    );
  }

  // status === 'approved' → puede elegir. Experiencia inmersiva (D-30): caja
  // de regalo que se abre con confeti antes de revelar el saludo/selección.
  return (
    <>
      <GiftBackground />
      <GiftReveal>
        <div className="flex flex-1 flex-col items-center gap-6 px-4 py-8 text-white">
          <div className="space-y-2 text-center">
            <span className="text-5xl">🎂</span>
            <h1 className="text-2xl font-bold">
              ¡Feliz cumpleaños, {clientName}!
            </h1>
            <p className="text-sm text-white/70">
              {businessName} quiere hacerte un regalo especial. Elige tu
              servicio gratis:
            </p>
          </div>

          <BirthdayChoiceForm token={token} options={options} />

          <p className="max-w-[34ch] text-center text-xs text-white/50">
            Redimible durante el mes de tu cumpleaños en tu próxima cita.
          </p>
        </div>
      </GiftReveal>
    </>
  );
}
