import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Segunda capa de seguridad para Finanzas y Ajustes (D-17).
 * Bloqueo de app con WebAuthn (huella/desbloqueo nativo) + contraseña de
 * respaldo. Las credenciales pertenecen al usuario (manicurista), no al tenant.
 */

/** Credenciales WebAuthn (autenticador de plataforma) registradas por el usuario. */
export const webauthnCredentials = pgTable(
  "webauthn_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    /** credentialID en base64url. */
    credentialId: text("credential_id").notNull().unique(),
    /** Clave pública COSE en base64url. */
    publicKey: text("public_key").notNull(),
    counter: integer("counter").notNull().default(0),
    /** Transportes reportados por el autenticador (csv), p. ej. "internal,hybrid". */
    transports: text("transports"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("webauthn_credentials_user_idx").on(t.userId)],
);

export type WebauthnCredential = typeof webauthnCredentials.$inferSelect;

/** Estado del bloqueo de app por usuario. */
export const appLockSettings = pgTable("app_lock_settings", {
  userId: text("user_id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AppLockSettings = typeof appLockSettings.$inferSelect;
