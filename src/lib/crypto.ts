import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * Cifrado simétrico de secretos (F5.B1) — AES-256-GCM.
 * Se usa para guardar el refresh_token de Google cifrado en la DB.
 *
 * La clave viene de `GOOGLE_TOKEN_KEY` (cualquier cadena de alta entropía); se
 * normaliza a 32 bytes con SHA-256. El payload resultante es
 * `iv:authTag:ciphertext`, todo en base64.
 */

const ALGO = "aes-256-gcm";

function keyFrom(source: string | undefined): Buffer {
  if (!source) {
    throw new Error("GOOGLE_TOKEN_KEY no está configurada.");
  }
  return createHash("sha256").update(source).digest();
}

export function encryptSecret(
  plaintext: string,
  keySource: string | undefined = process.env.GOOGLE_TOKEN_KEY,
): string {
  const key = keyFrom(keySource);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(
  payload: string,
  keySource: string | undefined = process.env.GOOGLE_TOKEN_KEY,
): string {
  const key = keyFrom(keySource);
  const [ivB64, tagB64, ctB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error("Payload cifrado inválido.");
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
