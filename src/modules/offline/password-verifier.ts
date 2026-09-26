/**
 * Verificador local de la contraseña de la cuenta para desbloquear sin
 * conexión (D-35). Se guarda SOLO un derivado PBKDF2-SHA256 con sal aleatoria,
 * nunca la contraseña. Se captura al iniciar sesión o desbloquear con
 * contraseña estando en línea (momento en que el servidor ya la validó).
 */

export const PBKDF2_ITERATIONS = 310_000;

export type PasswordVerifier = {
  /** Usuario al que pertenece; null hasta la primera confirmación en línea. */
  userId: string | null;
  salt: string; // base64
  hash: string; // base64
  iterations: number;
};

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function derive(
  subtle: SubtleCrypto,
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array> {
  const key = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** Crea el verificador (sal nueva) para una contraseña ya validada por el servidor. */
export async function createPasswordVerifier(
  password: string,
  userId: string | null,
  cryptoImpl: Crypto = globalThis.crypto,
  iterations = PBKDF2_ITERATIONS,
): Promise<PasswordVerifier> {
  const salt = cryptoImpl.getRandomValues(new Uint8Array(16));
  const hash = await derive(cryptoImpl.subtle, password, salt, iterations);
  return { userId, salt: toB64(salt), hash: toB64(hash), iterations };
}

/** Comparación en tiempo constante del derivado. */
export async function checkPassword(
  password: string,
  verifier: PasswordVerifier,
  cryptoImpl: Crypto = globalThis.crypto,
): Promise<boolean> {
  const expected = fromB64(verifier.hash);
  const actual = await derive(
    cryptoImpl.subtle,
    password,
    fromB64(verifier.salt),
    verifier.iterations,
  );
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}
