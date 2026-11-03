"use client";

import { Minus, Plus, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/duration";
import { formatCOP } from "@/lib/money";
import { formatPhoneCO } from "@/lib/phone";
import { ClientSheet } from "@/modules/clients/components/client-sheet";

import { createAppointmentAction } from "../actions";

type ClientOption = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
};

function initialLetter(name: string): string {
  const ch = name.trim()[0]?.toUpperCase() ?? "#";
  return /^[A-Z]$/.test(ch) ? ch : "#";
}
type ServiceOption = {
  id: string;
  name: string;
  basePriceCop: number;
  durationMin: number;
};
type PaymentKind = "pending" | "paid" | "partial";

/**
 * Una persona atendida y los servicios que recibe. El nombre solo es
 * obligatorio cuando hay más de una persona (comprobante discriminado,
 * D-38) — con una sola persona el nombre de la clienta ya es la fuente
 * de verdad, así que no hace falta repetirlo.
 */
type PersonRow = { id: string; name: string; serviceIds: string[] };

function newPerson(): PersonRow {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    name: "",
    serviceIds: [],
  };
}

export function AppointmentForm({
  clients,
  services,
  todayKey,
  defaultTime,
  initialClientId,
}: {
  clients: ClientOption[];
  services: ServiceOption[];
  todayKey: string;
  defaultTime: string;
  initialClientId?: string | null;
}) {
  const router = useRouter();

  const [clientList, setClientList] = useState(clients);
  const [clientId, setClientId] = useState<string | null>(
    initialClientId && clients.some((c) => c.id === initialClientId)
      ? initialClientId
      : null,
  );
  const [clientQuery, setClientQuery] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  const [persons, setPersons] = useState<PersonRow[]>([newPerson()]);
  const [date, setDate] = useState(todayKey);
  const [time, setTime] = useState(defaultTime);
  const [durationEdited, setDurationEdited] = useState(false);
  const [durationMin, setDurationMin] = useState(60);
  const [totalEdited, setTotalEdited] = useState(false);
  const [totalValue, setTotalValue] = useState(0);
  const [notes, setNotes] = useState("");
  const [paymentKind, setPaymentKind] = useState<PaymentKind>("pending");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [inviteClient, setInviteClient] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [overlap, setOverlap] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedClient = clientList.find((c) => c.id === clientId) ?? null;
  const serviceById = useMemo(
    () => new Map(services.map((s) => [s.id, s])),
    [services],
  );

  const availableLetters = useMemo(() => {
    const set = new Set(clientList.map((c) => initialLetter(c.name)));
    const sorted = [...set].sort();
    if (sorted[0] === "#") sorted.push(sorted.shift()!);
    return sorted;
  }, [clientList]);

  function personSubtotal(p: PersonRow): number {
    return p.serviceIds.reduce(
      (sum, sid) => sum + (serviceById.get(sid)?.basePriceCop ?? 0),
      0,
    );
  }

  const computedTotal = persons.reduce((sum, p) => sum + personSubtotal(p), 0);
  const suggestedDuration = persons.reduce(
    (sum, p) =>
      sum +
      p.serviceIds.reduce(
        (d, sid) => d + (serviceById.get(sid)?.durationMin ?? 0),
        0,
      ),
    0,
  );
  const effectiveDuration = durationEdited
    ? durationMin
    : suggestedDuration || 60;
  const effectiveTotal = totalEdited ? totalValue : computedTotal;
  const assignedCount = persons.reduce((n, p) => n + p.serviceIds.length, 0);

  const q = clientQuery.trim().toLowerCase();
  const filteredClients = q
    ? clientList.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(clientQuery.replace(/\D/g, "")),
      )
    : activeLetter
      ? clientList.filter((c) => initialLetter(c.name) === activeLetter)
      : [];

  function toggleService(personId: string, serviceId: string) {
    setPersons((prev) =>
      prev.map((p) => {
        if (p.id !== personId) return p;
        const has = p.serviceIds.includes(serviceId);
        return {
          ...p,
          serviceIds: has
            ? p.serviceIds.filter((s) => s !== serviceId)
            : [...p.serviceIds, serviceId],
        };
      }),
    );
  }

  function setPersonName(personId: string, name: string) {
    setPersons((prev) =>
      prev.map((p) => (p.id === personId ? { ...p, name } : p)),
    );
  }

  function addPerson() {
    setPersons((prev) => (prev.length >= 10 ? prev : [...prev, newPerson()]));
  }

  function removePerson(personId: string) {
    setPersons((prev) =>
      prev.length <= 1 ? prev : prev.filter((p) => p.id !== personId),
    );
  }

  async function submit(force: boolean) {
    setError(null);
    if (!clientId) {
      setError("Selecciona una clienta.");
      return;
    }
    // Agrega los servicios de todas las personas (cantidad = nº de personas
    // que reciben ese servicio).
    const counts = new Map<string, number>();
    for (const p of persons) {
      for (const sid of p.serviceIds) {
        counts.set(sid, (counts.get(sid) ?? 0) + 1);
      }
    }
    if (counts.size === 0) {
      setError("Asigna al menos un servicio a alguna persona.");
      return;
    }
    // Nombre y al menos un servicio por persona, cuando hay más de una
    // (comprobante discriminado, ítem nuevo): con 1 persona no hace falta
    // repetir el nombre de la clienta.
    if (persons.length > 1) {
      if (persons.some((p) => p.name.trim() === "")) {
        setError("Escribe el nombre de cada persona atendida.");
        return;
      }
      if (persons.some((p) => p.serviceIds.length === 0)) {
        setError("Asigna al menos un servicio a cada persona, o quítala.");
        return;
      }
    }

    setSubmitting(true);
    const result = await createAppointmentAction({
      clientId,
      services: [...counts.entries()].map(([serviceId, quantity]) => ({
        serviceId,
        quantity,
      })),
      date,
      time,
      durationMin: effectiveDuration,
      totalOverride: totalEdited ? totalValue : null,
      peopleCount: persons.length,
      people:
        persons.length > 1
          ? persons.map((p) => ({
              name: p.name.trim(),
              serviceIds: p.serviceIds,
            }))
          : undefined,
      notes,
      payment: {
        kind: paymentKind,
        amount: paymentKind === "partial" ? paymentAmount : 0,
      },
      force,
      inviteClient: selectedClient?.email ? inviteClient : false,
    });
    setSubmitting(false);

    if (result.ok) {
      toast.success("Cita creada");
      router.push(`/citas/${result.id}`);
      router.refresh();
      return;
    }
    if (result.overlap) {
      setOverlap(
        `Se solapa con la cita de ${result.overlap.clientName} a las ${result.overlap.timeLabel}.`,
      );
      return;
    }
    setError(result.error);
  }

  return (
    <div className="space-y-8 pb-4">
      {/* Clienta */}
      <section className="space-y-2">
        <Label>Clienta</Label>
        {selectedClient ? (
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{selectedClient.name}</p>
              <p className="text-muted-foreground truncate text-sm">
                {formatPhoneCO(selectedClient.phone)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Cambiar clienta"
              onClick={() => setClientId(null)}
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              type="search"
              placeholder="Buscar clienta por nombre o teléfono"
              value={clientQuery}
              onChange={(e) => {
                setClientQuery(e.target.value);
                if (e.target.value) setActiveLetter(null);
              }}
            />
            {/* Índice alfabético — solo cuando no hay búsqueda */}
            {!q && availableLetters.length > 1 && (
              <div
                className="flex gap-1 overflow-x-auto pb-0.5"
                aria-label="Filtrar por letra"
              >
                {availableLetters.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() =>
                      setActiveLetter((prev) =>
                        prev === letter ? null : letter,
                      )
                    }
                    className={cn(
                      "flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors",
                      activeLetter === letter
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                    aria-pressed={activeLetter === letter}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            )}
            {(q || activeLetter) && (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border">
                {filteredClients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setClientId(c.id);
                      setClientQuery("");
                      setActiveLetter(null);
                    }}
                    className="hover:bg-accent flex w-full items-center justify-between px-3 py-2 text-left"
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="text-muted-foreground text-sm">
                      {formatPhoneCO(c.phone)}
                    </span>
                  </button>
                ))}
                {filteredClients.length === 0 && (
                  <p className="text-muted-foreground px-3 py-2 text-sm">
                    Ninguna clienta coincide.
                  </p>
                )}
              </div>
            )}
            <ClientSheet
              onCreated={(created) => {
                setClientList((prev) => [
                  {
                    id: created.id,
                    name: created.name,
                    phone: "",
                    email: null,
                  },
                  ...prev,
                ]);
                setClientId(created.id);
              }}
              trigger={
                <Button variant="outline" size="sm" className="w-full">
                  <UserPlus className="size-4" />
                  Crear clienta nueva
                </Button>
              }
            />
          </div>
        )}
      </section>

      {/* Personas atendidas */}
      <section className="space-y-2">
        <Label>Personas atendidas</Label>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Menos personas"
            disabled={persons.length <= 1}
            onClick={() => removePerson(persons[persons.length - 1].id)}
          >
            <Minus className="size-4" />
          </Button>
          <span className="w-8 text-center text-lg tabular-nums">
            {persons.length}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Más personas"
            disabled={persons.length >= 10}
            onClick={addPerson}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </section>

      {/* Asignación de servicios por persona */}
      <section className="space-y-3">
        <Label>Servicios por persona</Label>
        {services.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Agrega servicios para poder asignarlos.
          </p>
        ) : (
          persons.map((p, i) => (
            <div key={p.id} className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Persona {i + 1}</span>
                <Input
                  className="h-8 flex-1"
                  placeholder={
                    persons.length > 1 ? "Nombre" : "Nombre (opcional)"
                  }
                  value={p.name}
                  onChange={(e) => setPersonName(p.id, e.target.value)}
                />
                {persons.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Quitar persona ${i + 1}`}
                    onClick={() => removePerson(p.id)}
                  >
                    <X className="size-4" />
                  </Button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {services.map((s) => {
                  const active = p.serviceIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleService(p.id, s.id)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm",
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-right text-sm">
                Subtotal:{" "}
                <span className="font-medium">
                  {formatCOP(BigInt(personSubtotal(p)))}
                </span>
              </p>
            </div>
          ))
        )}
      </section>

      {/* Total general */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Total general</Label>
          <span className="text-muted-foreground text-sm">
            {assignedCount} {assignedCount === 1 ? "servicio" : "servicios"} ·{" "}
            {formatDuration(effectiveDuration)}
          </span>
        </div>
        <MoneyInput
          value={effectiveTotal}
          onChange={(v) => {
            setTotalEdited(true);
            setTotalValue(v);
          }}
        />
        {totalEdited ? (
          <button
            type="button"
            onClick={() => {
              setTotalEdited(false);
              setTotalValue(0);
            }}
            className="text-muted-foreground text-xs hover:underline"
          >
            Usar el total calculado ({formatCOP(BigInt(computedTotal))})
          </button>
        ) : null}
      </section>

      {/* Fecha y hora */}
      <section className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="date">Fecha</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setOverlap(null);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="time">Hora</Label>
          <Input
            id="time"
            type="time"
            step={900}
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
              setOverlap(null);
            }}
          />
        </div>
        <div className="col-span-2 space-y-2">
          <Label htmlFor="duration">Duración (minutos)</Label>
          <Input
            id="duration"
            type="number"
            inputMode="numeric"
            min={1}
            step={5}
            value={effectiveDuration}
            onChange={(e) => {
              setDurationEdited(true);
              setDurationMin(
                e.target.value === "" ? 0 : Number(e.target.value),
              );
            }}
          />
        </div>
      </section>

      {/* Estado de pago */}
      <section className="space-y-2">
        <Label>Estado de pago</Label>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["pending", "Pendiente"],
              ["paid", "Pagada"],
              ["partial", "Abono"],
            ] as [PaymentKind, string][]
          ).map(([kind, label]) => (
            <Button
              key={kind}
              type="button"
              variant={paymentKind === kind ? "default" : "outline"}
              onClick={() => setPaymentKind(kind)}
            >
              {label}
            </Button>
          ))}
        </div>
        {paymentKind === "partial" ? (
          <div className="space-y-1 pt-1">
            <Label htmlFor="abono">Monto del abono</Label>
            <MoneyInput
              id="abono"
              value={paymentAmount}
              onChange={setPaymentAmount}
            />
          </div>
        ) : null}
      </section>

      {/* Notas */}
      <section className="space-y-2">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea
          id="notes"
          rows={2}
          placeholder="Diseño, color, observaciones…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </section>

      {selectedClient?.email ? (
        <label className="flex items-start gap-3 rounded-xl border p-3">
          <input
            type="checkbox"
            className="accent-primary mt-0.5 size-4"
            checked={inviteClient}
            onChange={(e) => setInviteClient(e.target.checked)}
          />
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">
              Invitar a la clienta por correo
            </span>
            <span className="text-muted-foreground block text-sm">
              Google enviará la invitación a {selectedClient.email}.
            </span>
          </span>
        </label>
      ) : null}

      {overlap ? (
        <div className="border-destructive/40 bg-destructive/5 space-y-2 rounded-xl border p-3">
          <p className="text-sm">{overlap}</p>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={submitting}
            onClick={() => submit(true)}
          >
            Crear de todos modos
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={submitting}
        onClick={() => submit(false)}
      >
        {submitting
          ? "Guardando…"
          : `Crear cita · ${formatCOP(BigInt(effectiveTotal))}`}
      </Button>
    </div>
  );
}
