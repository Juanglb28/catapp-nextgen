import { shiftDayKey, tenantDayKey, tenantDayRangeUtc } from "@/lib/dates";
import { listAppointmentRefsInRange } from "@/modules/appointments/repository";

import { OFFLINE_AGENDA_DAYS, OFFLINE_MAX_DETAIL_PAGES } from "./constants";
import { buildOfflineUrls } from "./urls";

/** Manifiesto offline del tenant (tenant-scoped, D-11). */
export async function offlineManifest(
  tenantId: string,
  tz: string,
): Promise<string[]> {
  const today = tenantDayKey(new Date(), tz);
  const { start } = tenantDayRangeUtc(today, tz);
  const { start: end } = tenantDayRangeUtc(
    shiftDayKey(today, OFFLINE_AGENDA_DAYS),
    tz,
  );
  const rows = await listAppointmentRefsInRange(
    tenantId,
    start,
    end,
    OFFLINE_MAX_DETAIL_PAGES,
  );
  return buildOfflineUrls(today, rows);
}
