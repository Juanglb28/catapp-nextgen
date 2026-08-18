import { normalizePhone } from "@/lib/phone";
import {
  fetchGoogleContacts,
  getAccessTokenForSettings,
  type GoogleContact,
} from "@/modules/calendar/google";
import { getGoogleAccount } from "@/modules/calendar/repository";

/**
 * Contacto de Google preparado para la pantalla de importación.
 * `importable` indica si tiene un teléfono válido (colombiano o internacional).
 */
export type PreparedContact = {
  resourceName: string;
  name: string;
  /** Teléfono tal como viene de Google (para mostrar en la UI). */
  phone: string | null;
  /** E.164 (+57XXXXXXXXXX, o +indicativo... para otros países) o null si no es válido. */
  phoneNormalized: string | null;
  email: string | null;
  /** "YYYY-MM-DD" extraído de Google Contacts, o null si no tiene. */
  birthdayDate: string | null;
  importable: boolean;
  /** Por qué no se puede importar (solo cuando importable === false). */
  skipReason?: string;
};

export type ContactsForImportResult =
  | { status: "not_connected" }
  | { status: "broken" }
  | { status: "needs_scope" }
  | { status: "error"; message: string }
  | { status: "ok"; contacts: PreparedContact[] };

/**
 * Punto de entrada del Server Component de importación.
 * Obtiene el access_token del tenant y llama a la People API.
 */
export async function getContactsForImport(
  tenantId: string,
): Promise<ContactsForImportResult> {
  const account = await getGoogleAccount(tenantId);
  if (!account) return { status: "not_connected" };

  const accessToken = await getAccessTokenForSettings(tenantId);
  if (!accessToken) return { status: "broken" };

  try {
    const raw = await fetchGoogleContacts(accessToken);
    const contacts = raw.map(prepareContact);
    // Importables primero, luego orden alfabético.
    contacts.sort((a, b) => {
      if (a.importable !== b.importable) return a.importable ? -1 : 1;
      return a.name.localeCompare(b.name, "es");
    });
    return { status: "ok", contacts };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido.";
    // 403 = falta el scope contacts.readonly → pedir re-autorización.
    if (msg.includes("403")) return { status: "needs_scope" };
    return { status: "error", message: msg };
  }
}

/**
 * Extrae la fecha de cumpleaños de un contacto de Google en formato "YYYY-MM-DD".
 * Si Google no tiene el año, usa 1900 como placeholder.
 * Devuelve null si no hay cumpleaños registrado.
 */
function extractBirthday(contact: GoogleContact): string | null {
  const bd = contact.birthdays?.[0]?.date;
  if (!bd) return null;
  const year = bd.year && bd.year > 1 ? bd.year : 1900;
  const month = String(bd.month).padStart(2, "0");
  const day = String(bd.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function prepareContact(contact: GoogleContact): PreparedContact {
  const name = contact.names?.[0]?.displayName?.trim() ?? "";
  const phone = contact.phoneNumbers?.[0]?.value?.trim() ?? null;
  const email = contact.emailAddresses?.[0]?.value?.trim() ?? null;
  const phoneNormalized = phone ? normalizePhone(phone) : null;
  const birthdayDate = extractBirthday(contact);

  if (!name) {
    return {
      resourceName: contact.resourceName,
      name: "(sin nombre)",
      phone,
      phoneNormalized,
      email,
      birthdayDate,
      importable: false,
      skipReason: "Sin nombre",
    };
  }
  if (!phone) {
    return {
      resourceName: contact.resourceName,
      name,
      phone,
      phoneNormalized,
      email,
      birthdayDate,
      importable: false,
      skipReason: "Sin teléfono",
    };
  }
  if (!phoneNormalized) {
    return {
      resourceName: contact.resourceName,
      name,
      phone,
      phoneNormalized,
      email,
      birthdayDate,
      importable: false,
      skipReason: "Teléfono inválido",
    };
  }

  return {
    resourceName: contact.resourceName,
    name,
    phone,
    phoneNormalized,
    email,
    birthdayDate,
    importable: true,
  };
}
