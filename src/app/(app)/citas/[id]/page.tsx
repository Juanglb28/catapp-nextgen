import { Check, FileText, Lock, Pencil, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatDateLong,
  formatDateTime,
  formatDateShort,
  formatTime,
  tenantDayKey,
  tenantTimeKey,
} from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { whatsappLink } from "@/lib/phone";
import { paymentBadgeClass } from "@/modules/appointments/agenda";
import { isLocked } from "@/modules/appointments/domain";
import { AppointmentHistory } from "@/modules/appointments/components/appointment-history";
import { EditAppointmentSheet } from "@/modules/appointments/components/edit-appointment-sheet";
import { EditServicesSheet } from "@/modules/appointments/components/edit-services-sheet";
import {
  RegisterPaymentSheet,
  type PaymentReceipt,
} from "@/modules/appointments/components/register-payment-sheet";
import { BirthdayBonusButton } from "@/modules/appointments/components/birthday-bonus-button";
import { ReceiptButton } from "@/modules/appointments/components/receipt-button";
import { CancelledActions } from "@/modules/appointments/components/cancelled-actions";
import { StatusActions } from "@/modules/appointments/components/status-actions";
import { GcalSyncStatus } from "@/modules/calendar/components/gcal-sync-status";
import {
  getActiveBonusForClient,
  getBonusForAppointment,
  getBonusOption,
} from "@/modules/birthdays/repository";
import type { ReceiptData } from "@/modules/appointments/receipt";
import {
  getAppointment,
  getAppointmentHistory,
} from "@/modules/appointments/repository";
import { listServices } from "@/modules/services/repository";
import { requireTenant } from "@/modules/tenancy/context";
import { getTenant } from "@/modules/tenancy/repository";
import { SendWhatsAppSheet } from "@/modules/whatsapp/components/send-whatsapp-sheet";
import {
  getTemplates,
  listAppointmentMessages,
} from "@/modules/whatsapp/repository";
import { renderTemplate, type TemplateKey } from "@/modules/whatsapp/templates";

export const metadata: Metadata = { title: "Cita" };

import {
  CONFIRMATION_BADGE,
  FIELD_LABEL,
  formatChangeValue,
  PAYMENT_LABEL,
  STATUS_LABEL,
} from "./cita-labels";

export default async function CitaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenantId } = await requireTenant();
  const { id } = await params;

  // Construir el link público con el proto correcto (https en Railway, http en dev).
  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const appointment = await getAppointment(tenantId, id);
  if (!appointment) notFound();

  const tenant = await getTenant(tenantId);
  const tz = tenant?.timezone ?? "America/Bogota";

  const [
    history,
    catalog,
    templates,
    waMessages,
    birthdayBonus,
    redeemedBonus,
  ] = await Promise.all([
    getAppointmentHistory(tenantId, id),
    listServices(tenantId),
    getTemplates(tenantId),
    listAppointmentMessages(tenantId, id),
    getActiveBonusForClient(tenantId, appointment.clientId),
    getBonusForAppointment(tenantId, id),
  ]);

  const locked = isLocked(appointment.status);
  const netTotal = appointment.totalCop - appointment.bonusDiscountCop;
  const saldo = netTotal - appointment.paidCop;
  // Valor del bono elegido = descuento de la opción del catálogo (D-19, B1.1).
  const chosenBonusOption = birthdayBonus?.chosenOptionId
    ? await getBonusOption(tenantId, birthdayBonus.chosenOptionId)
    : null;
  const bonusOptionValue = chosenBonusOption?.discountCop ?? 0n;
  const durationMin = Math.round(
    (appointment.endsAt.getTime() - appointment.startsAt.getTime()) / 60_000,
  );

  const computedSubtotal = appointment.services.reduce(
    (sum, s) => sum + s.priceCop * BigInt(s.quantity),
    0n,
  );
  const overridden = appointment.totalCop !== computedSubtotal;

  // Línea de servicio por id (precio congelado, D-10), usada para resolver
  // el desglose por persona (comprobante discriminado, D-38) tanto en la UI
  // como al armar receiptData/paymentReceipt.
  const serviceLineById = new Map(
    appointment.services.map((line) => [line.serviceId, line]),
  );
  const peopleBreakdown = appointment.people.map((person) => ({
    name: person.name,
    services: person.serviceIds
      .map((serviceId) => serviceLineById.get(serviceId))
      .filter((line): line is NonNullable<typeof line> => line !== undefined)
      .map((line) => ({
        name: line.service.name,
        quantity: line.quantity,
        amount: formatCOP(line.priceCop * BigInt(line.quantity)),
      })),
  }));

  // Opciones del sheet de servicios: catálogo activo + los de la cita (precio
  // congelado) que ya no estén activos.
  const optionMap = new Map<
    string,
    { id: string; name: string; priceCop: number }
  >();
  for (const s of catalog) {
    optionMap.set(s.id, {
      id: s.id,
      name: s.name,
      priceCop: Number(s.basePriceCop),
    });
  }
  for (const line of appointment.services) {
    optionMap.set(line.serviceId, {
      id: line.serviceId,
      name: line.service.name,
      priceCop: Number(line.priceCop),
    });
  }
  const serviceOptions = [...optionMap.values()];
  const initialQty: Record<string, number> = {};
  for (const line of appointment.services)
    initialQty[line.serviceId] = line.quantity;

  const historyItems = history.map((change) => ({
    when: `${formatDateShort(change.changedAt, tz)} ${formatTime(change.changedAt, tz)}`,
    text: `${FIELD_LABEL[change.field] ?? change.field}: ${formatChangeValue(
      change.field,
      change.oldValue,
      tz,
    )} → ${formatChangeValue(change.field, change.newValue, tz)}`,
  }));

  // --- WhatsApp (F4.B2) ---
  const lastStartChange = [...history]
    .reverse()
    .find((c) => c.field === "starts_at" && c.oldValue);
  const fechaAnterior = lastStartChange?.oldValue
    ? formatDateTime(new Date(lastStartChange.oldValue), tz)
    : undefined;

  const waVars = {
    clienta: appointment.client.name.trim().split(/\s+/)[0],
    negocio: tenant?.name ?? "",
    fecha: formatDateLong(appointment.startsAt, tz),
    hora: formatTime(appointment.startsAt, tz),
    servicios: appointment.services
      .map((l) =>
        l.quantity > 1 ? `${l.service.name} ×${l.quantity}` : l.service.name,
      )
      .join(", "),
    saldo: formatCOP(saldo > 0n ? saldo : 0n),
    fecha_anterior: fechaAnterior,
    // Link público con proto real: https en Railway → tappable en WhatsApp.
    link: host
      ? `${proto}://${host}/cita/${appointment.publicToken}`
      : undefined,
  };

  // WhatsApp paz y salvo — se abre automáticamente al registrar el pago.
  // Si la cita usó bono de cumpleaños, el paz y salvo lo notifica.
  const thankyouKey: TemplateKey =
    appointment.bonusDiscountCop > 0n ? "thankyou_bonus" : "thankyou";
  const thankyouWaText = renderTemplate(templates[thankyouKey], {
    clienta: appointment.client.name.trim().split(/\s+/)[0],
    negocio: tenant?.name ?? "",
  });
  // Propina y método de pago para el comprobante (recibos con propina/método).
  const receiptTipLabel =
    appointment.tipCop > 0n ? formatCOP(appointment.tipCop) : null;
  const receiptMethodLabel =
    appointment.cashCop > 0n && appointment.transferCop > 0n
      ? "Efectivo y transferencia"
      : appointment.cashCop > 0n || appointment.paymentMethod === "efectivo"
        ? "Efectivo"
        : appointment.transferCop > 0n ||
            appointment.paymentMethod === "transferencia"
          ? "Transferencia"
          : null;

  // Comprobante que se envía al registrar el pago (imagen + mensaje). Se arma
  // como "pagado en total"; si el pago es un abono, el sheet ajusta el saldo y
  // usa el recordatorio de pago como mensaje en lugar del paz y salvo.
  const paymentReceipt: PaymentReceipt | undefined =
    appointment.status !== "cancelled"
      ? {
          base: {
            variant: "paid",
            businessName: tenant?.name ?? "",
            clientName: appointment.client.name,
            dateLabel: formatDateLong(appointment.startsAt, tz),
            timeLabel: `${formatTime(appointment.startsAt, tz)} – ${formatTime(
              appointment.endsAt,
              tz,
            )}`,
            services: appointment.services.map((l) => ({
              name: l.service.name,
              quantity: l.quantity,
              amount: formatCOP(l.priceCop * BigInt(l.quantity)),
            })),
            people: peopleBreakdown.length > 0 ? peopleBreakdown : undefined,
            totalLabel: formatCOP(netTotal),
            bonusLabel:
              appointment.bonusDiscountCop > 0n
                ? formatCOP(appointment.bonusDiscountCop)
                : null,
            paidLabel: formatCOP(netTotal),
            saldoLabel: null,
            tipLabel: receiptTipLabel,
            methodLabel: receiptMethodLabel,
            statusLabel: "Pagada",
            note: null,
          },
          netTotalCop: Number(netTotal),
          alreadyPaidCop: Number(appointment.paidCop),
          alreadyTipCop: Number(appointment.tipCop),
          phone: appointment.client.phone,
          fullCaption: thankyouWaText,
          partialTemplate: templates.payment_reminder,
          clienta: appointment.client.name.trim().split(/\s+/)[0],
          negocio: tenant?.name ?? "",
        }
      : undefined;

  // Comprobante: disponible cuando la cita quedó pagada (aunque sea un abono
  // por adelantado a una cita aún agendada) o cancelada. No depende de si la
  // vista pública de la clienta sigue abierta — desde D-24 esa vista solo se
  // cierra cuando la cita ya sucedió y quedó pagada, o está cancelada.
  const receiptData: ReceiptData | null =
    appointment.paymentStatus === "paid" || appointment.status === "cancelled"
      ? {
          variant: appointment.status === "cancelled" ? "cancelled" : "paid",
          businessName: tenant?.name ?? "",
          clientName: appointment.client.name,
          dateLabel: formatDateLong(appointment.startsAt, tz),
          timeLabel: `${formatTime(appointment.startsAt, tz)} – ${formatTime(
            appointment.endsAt,
            tz,
          )}`,
          services: appointment.services.map((l) => ({
            name: l.service.name,
            quantity: l.quantity,
            amount: formatCOP(l.priceCop * BigInt(l.quantity)),
          })),
          people: peopleBreakdown.length > 0 ? peopleBreakdown : undefined,
          totalLabel: formatCOP(netTotal),
          bonusLabel:
            appointment.bonusDiscountCop > 0n
              ? formatCOP(appointment.bonusDiscountCop)
              : null,
          paidLabel: formatCOP(appointment.paidCop),
          saldoLabel: saldo > 0n ? formatCOP(saldo) : null,
          tipLabel: receiptTipLabel,
          methodLabel:
            appointment.status === "cancelled" ? null : receiptMethodLabel,
          statusLabel:
            appointment.status === "cancelled" ? "Cancelada" : "Pagada",
          note: null,
        }
      : null;

  const applicableKeys: TemplateKey[] =
    appointment.status === "completed"
      ? [thankyouKey]
      : ["confirmation", "reminder"];
  if (fechaAnterior) applicableKeys.push("reschedule");
  // Recordatorio de pago: disponible cuando queda saldo pendiente (cualquier
  // estado salvo cancelada).
  if (saldo > 0n && appointment.status !== "cancelled") {
    applicableKeys.push("payment_reminder");
  }
  const waTemplates = applicableKeys.map((key) => ({
    key,
    text: templates[key],
  }));

  return (
    <div className="space-y-6 pb-10">
      <Link
        href="/citas"
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Citas
      </Link>

      {/* Clienta + estado */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Link
            href={`/clientas/${appointment.clientId}`}
            className="text-2xl font-semibold tracking-tight hover:underline"
          >
            {appointment.client.name}
          </Link>
          <Badge variant="secondary">
            {STATUS_LABEL[appointment.status] ?? appointment.status}
          </Badge>
          {appointment.status === "scheduled" &&
            (() => {
              const conf = CONFIRMATION_BADGE[appointment.clientConfirmation];
              return conf ? (
                <Badge variant="outline" className={conf.cls}>
                  {conf.label}
                </Badge>
              ) : null;
            })()}
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <a
              href={whatsappLink(appointment.client.phone)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppIcon className="size-4" />
              Chatear
            </a>
          </Button>
          <SendWhatsAppSheet
            clientPhone={appointment.client.phone}
            publicToken={appointment.publicToken}
            templates={waTemplates}
            vars={waVars}
            trigger={
              <Button size="sm">
                <WhatsAppIcon className="size-4" />
                Mensaje
              </Button>
            }
          />
        </div>
      </div>

      {locked ? (
        <p className="text-muted-foreground flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-sm">
          <Lock className="size-4 shrink-0" aria-hidden />
          Cita cancelada. No se puede editar.
        </p>
      ) : null}

      {/* Bono de cumpleaños activo */}
      {birthdayBonus?.status === "chosen" && birthdayBonus.chosenOption ? (
        <div className="rounded-xl border border-pink-200 bg-pink-50 px-3 py-2 text-sm">
          <p className="font-medium text-pink-800">
            🎂 Bono de cumpleaños activo
          </p>
          <p className="mt-0.5 text-pink-700">
            Regalo elegido:{" "}
            <span className="font-semibold">{birthdayBonus.chosenOption}</span>
            {appointment.bonusDiscountCop > 0n
              ? " — descuento aplicado a esta cita."
              : " — servicio gratis."}
          </p>
          {!locked && appointment.bonusDiscountCop === 0n ? (
            <div className="mt-2">
              <BirthdayBonusButton
                appointmentId={appointment.id}
                mode="apply"
                label={
                  bonusOptionValue > 0n
                    ? `Aplicar bono (−${formatCOP(bonusOptionValue)})`
                    : "Aplicar bono"
                }
              />
              {bonusOptionValue === 0n ? (
                <p className="mt-1 text-xs text-pink-700">
                  Define el valor de este bono en Ajustes → Bono de cumpleaños.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : redeemedBonus?.status === "redeemed" && redeemedBonus.chosenOption ? (
        <div className="rounded-xl border border-pink-200 bg-pink-50 px-3 py-2 text-sm">
          <p className="font-medium text-pink-800">
            🎂 Bono de cumpleaños redimido
          </p>
          <p className="mt-0.5 text-pink-700">
            Regalo:{" "}
            <span className="font-semibold">{redeemedBonus.chosenOption}</span>{" "}
            — descuento aplicado a esta cita. El bono quedó invalidado.
          </p>
        </div>
      ) : birthdayBonus?.status === "approved" ? (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm">
          <p className="text-yellow-800">
            🎂 La clienta tiene un bono de cumpleaños activo pero aún no ha
            elegido su servicio.
          </p>
        </div>
      ) : null}

      {/* Fecha / hora */}
      <section className="space-y-1">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Fecha y hora</h2>
          {!locked ? (
            <EditAppointmentSheet
              appointmentId={appointment.id}
              initial={{
                date: tenantDayKey(appointment.startsAt, tz),
                time: tenantTimeKey(appointment.startsAt, tz),
                durationMin,
                peopleCount: appointment.peopleCount,
                notes: appointment.notes ?? "",
              }}
              trigger={
                <Button variant="ghost" size="sm">
                  <Pencil className="size-4" />
                  Editar
                </Button>
              }
            />
          ) : null}
        </div>
        <p className="capitalize">{formatDateLong(appointment.startsAt, tz)}</p>
        <p className="text-muted-foreground">
          {formatTime(appointment.startsAt, tz)} –{" "}
          {formatTime(appointment.endsAt, tz)} · {appointment.peopleCount}{" "}
          {appointment.peopleCount === 1 ? "persona" : "personas"}
        </p>
      </section>

      {/* Servicios */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Servicios</h2>
          {!locked ? (
            <EditServicesSheet
              appointmentId={appointment.id}
              serviceOptions={serviceOptions}
              initialQty={initialQty}
              overridden={overridden}
              currentTotal={Number(appointment.totalCop)}
              trigger={
                <Button variant="ghost" size="sm">
                  <Pencil className="size-4" />
                  Editar
                </Button>
              }
            />
          ) : null}
        </div>
        <ul className="space-y-1">
          {appointment.services.map((line) => (
            <li
              key={line.serviceId}
              className="flex items-center justify-between text-sm"
            >
              <span>
                {line.service.name}
                {line.quantity > 1 ? ` ×${line.quantity}` : ""}
              </span>
              <span className="text-muted-foreground">
                {formatCOP(line.priceCop * BigInt(line.quantity))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Personas atendidas (comprobante discriminado, D-38). Solo existe
          cuando la cita se creó con más de 1 persona y se guardaron los
          nombres; citas viejas sin este dato simplemente no muestran la
          sección. No es editable aquí — ver comentario en repository.ts
          sobre por qué se borra al editar servicios. */}
      {peopleBreakdown.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Personas atendidas</h2>
          <ul className="space-y-2">
            {peopleBreakdown.map((person, i) => (
              <li key={i} className="rounded-lg border p-2">
                <p className="text-sm font-medium">{person.name}</p>
                <ul className="space-y-1">
                  {person.services.map((s, j) => (
                    <li
                      key={j}
                      className="text-muted-foreground flex items-center justify-between text-xs"
                    >
                      <span>
                        {s.name}
                        {s.quantity > 1 ? ` ×${s.quantity}` : ""}
                      </span>
                      <span>{s.amount}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Totales y pago */}
      <section className="space-y-2 rounded-xl border p-3">
        {appointment.bonusDiscountCop > 0n ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Subtotal</span>
              <span>
                {formatCOP(appointment.totalCop)}
                {overridden ? (
                  <span className="text-muted-foreground ml-1 text-xs">
                    (editado)
                  </span>
                ) : null}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                Bono de cumpleaños
              </span>
              <span className="flex items-center gap-2 text-pink-700">
                −{formatCOP(appointment.bonusDiscountCop)}
                {!locked ? (
                  <BirthdayBonusButton
                    appointmentId={appointment.id}
                    mode="remove"
                    label="Quitar"
                  />
                ) : null}
              </span>
            </div>
          </>
        ) : null}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Total</span>
          <span className="font-medium">
            {formatCOP(netTotal)}
            {overridden && appointment.bonusDiscountCop === 0n ? (
              <span className="text-muted-foreground ml-1 text-xs">
                (editado)
              </span>
            ) : null}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Pagado</span>
          <span>{formatCOP(appointment.paidCop)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Saldo</span>
          <span className={saldo > 0n ? "font-medium text-amber-700" : ""}>
            {formatCOP(saldo > 0n ? saldo : 0n)}
          </span>
        </div>
        {appointment.tipCop > 0n ? (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Propina</span>
            <span>{formatCOP(appointment.tipCop)}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between pt-1">
          <Badge className={paymentBadgeClass(appointment.paymentStatus)}>
            {PAYMENT_LABEL[appointment.paymentStatus] ??
              appointment.paymentStatus}
          </Badge>
          <div className="flex items-center gap-2">
            <RegisterPaymentSheet
              appointmentId={appointment.id}
              mode="adjust"
              defaultAmount={Number(appointment.paidCop)}
              currentTip={Number(appointment.tipCop)}
              currentMethod={appointment.paymentMethod}
              currentCash={Number(appointment.cashCop)}
              currentTransfer={Number(appointment.transferCop)}
              trigger={
                <Button size="sm" variant="outline">
                  <Pencil className="size-4" />
                  Ajustar
                </Button>
              }
            />
            <RegisterPaymentSheet
              appointmentId={appointment.id}
              defaultAmount={Number(saldo > 0n ? saldo : 0n)}
              currentTip={Number(appointment.tipCop)}
              currentMethod={appointment.paymentMethod}
              receipt={paymentReceipt}
              trigger={
                <Button size="sm">
                  <Wallet className="size-4" />
                  Registrar pago
                </Button>
              }
            />
          </div>
        </div>
      </section>

      {/* Comprobante para la clienta (cita pagada o cancelada) */}
      {receiptData ? (
        <section className="space-y-2">
          <ReceiptButton
            data={receiptData}
            phone={appointment.client.phone}
            caption={
              receiptData.variant === "paid" ? thankyouWaText : undefined
            }
          />
        </section>
      ) : appointment.status !== "cancelled" && saldo > 0n ? (
        // Item 6: sin pago registrado, "Enviar comprobante" dispara el flujo de
        // pago (registra la operación) y el sheet envía el comprobante al final.
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Comprobante</h2>
          <p className="text-muted-foreground text-sm">
            Aún no registras el pago. Al enviar el comprobante se abrirá el
            flujo de pago para registrar la operación y luego enviarlo.
          </p>
          <RegisterPaymentSheet
            appointmentId={appointment.id}
            defaultAmount={Number(saldo > 0n ? saldo : 0n)}
            currentTip={Number(appointment.tipCop)}
            currentMethod={appointment.paymentMethod}
            receipt={paymentReceipt}
            trigger={
              <Button>
                <FileText className="size-4" />
                Enviar comprobante
              </Button>
            }
          />
        </section>
      ) : null}

      {/* Notas */}
      {appointment.notes ? (
        <section className="space-y-1">
          <h2 className="text-sm font-medium">Notas</h2>
          <p className="text-muted-foreground text-sm whitespace-pre-wrap">
            {appointment.notes}
          </p>
        </section>
      ) : null}

      {/* Acciones de estado */}
      {appointment.status === "scheduled" ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Estado</h2>
          <StatusActions
            appointmentId={appointment.id}
            completeSlot={
              appointment.paymentStatus === "pending" && saldo > 0n ? (
                <RegisterPaymentSheet
                  appointmentId={appointment.id}
                  defaultAmount={Number(saldo > 0n ? saldo : 0n)}
                  currentTip={Number(appointment.tipCop)}
                  currentMethod={appointment.paymentMethod}
                  receipt={paymentReceipt}
                  completeOnSuccess
                  trigger={
                    <Button>
                      <Check className="size-4" />
                      Completar
                    </Button>
                  }
                />
              ) : undefined
            }
          />
        </section>
      ) : null}

      {appointment.status === "cancelled" ||
      appointment.status === "completed" ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Estado</h2>
          <CancelledActions
            appointmentId={appointment.id}
            status={appointment.status}
          />
        </section>
      ) : null}

      {/* Estado de sincronización con Google Calendar (F5.B2) */}
      {waMessages.length > 0 ? (
        <section className="space-y-1">
          <h2 className="text-sm font-medium">WhatsApp</h2>
          <ul className="text-muted-foreground space-y-0.5 text-sm">
            {waMessages.map((m) => {
              const label = m.templateName.includes("record")
                ? "Recordatorio"
                : m.templateName.includes("confirm")
                  ? "Confirmación"
                  : m.templateName;
              const status =
                m.status === "read"
                  ? "leído ✓✓"
                  : m.status === "delivered"
                    ? "entregado ✓"
                    : m.status === "sent"
                      ? "enviado"
                      : m.status === "failed"
                        ? "falló"
                        : "en cola";
              return (
                <li key={m.id}>
                  {label}: {status}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <GcalSyncStatus
        appointmentId={appointment.id}
        status={appointment.gcalSyncStatus}
      />

      {/* Historial */}
      <AppointmentHistory items={historyItems} />
    </div>
  );
}
