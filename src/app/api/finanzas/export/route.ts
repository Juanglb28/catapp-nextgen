import { tenantDayKey, tenantTimeKey } from "@/lib/dates";
import { buildFinanceCsv, type FinanceCsvRow } from "@/modules/finance/csv";
import { monthlyRows } from "@/modules/finance/repository";
import { requireTenant } from "@/modules/tenancy/context";
import { getTenant } from "@/modules/tenancy/repository";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

/** Export CSV del mes (F6.B2): fecha, clienta, servicios, total, pagado, saldo, estado. */
export async function GET(request: Request) {
  const { tenantId } = await requireTenant();
  const tenant = await getTenant(tenantId);
  const tz = tenant?.timezone ?? "America/Bogota";

  const url = new URL(request.url);
  const [cy, cm] = tenantDayKey(new Date(), tz).split("-").map(Number);
  let year = Number(url.searchParams.get("year"));
  let month = Number(url.searchParams.get("month"));
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    year = cy;
    month = cm;
  }

  const rows = await monthlyRows(tenantId, year, month, tz);
  const csvRows: FinanceCsvRow[] = rows.map((r) => ({
    fecha: `${tenantDayKey(r.startsAt, tz)} ${tenantTimeKey(r.startsAt, tz)}`,
    clienta: r.clientName,
    servicios: r.servicesSummary,
    total: String(r.total),
    pagado: String(r.paid),
    saldo: String(r.saldo),
    estado: STATUS_LABEL[r.status] ?? r.status,
  }));

  const csv = buildFinanceCsv(csvRows);
  const filename = `finanzas-${year}-${String(month).padStart(2, "0")}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
