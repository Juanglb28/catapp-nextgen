/**
 * Mensajes de WhatsApp Cloud API (F8.B1). Las funciones viven en `repository.ts`
 * (único lugar autorizado a tocar `db`, D-11); este archivo solo re-exporta para
 * que `send.ts`, el webhook y los tests las consuman con un nombre claro.
 */
export {
  hasMessage,
  markFailed,
  markSent,
  queueMessage,
  updateStatusByWaId,
} from "./repository";
