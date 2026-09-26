/**
 * Desbloqueo con huella SIN conexión (D-35). Usa el autenticador de
 * plataforma del teléfono (el mismo registrado para el bloqueo de Finanzas,
 * D-17) con verificación de usuario obligatoria. Sin servidor no se puede
 * validar la firma contra la clave pública guardada en la base de datos; se
 * exige que el sistema operativo confirme la verificación (bandera UV) con una
 * credencial de esta cuenta. Es un control de acceso local, no una prueba
 * criptográfica ante el servidor: con conexión, Better Auth sigue siendo la
 * autoridad.
 */

function b64urlToBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const s = atob(b64 + pad);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Bit 2 (0x04) de flags en authenticatorData = User Verified. */
export function isUserVerified(authenticatorData: ArrayBuffer): boolean {
  const bytes = new Uint8Array(authenticatorData);
  // rpIdHash (32 bytes) + flags (1 byte)
  return bytes.length > 32 && (bytes[32]! & 0x04) === 0x04;
}

export function canUseLocalBiometric(ids: string[]): boolean {
  return (
    ids.length > 0 &&
    typeof window !== "undefined" &&
    "PublicKeyCredential" in window &&
    !!navigator.credentials
  );
}

/** Pide la huella; resuelve true solo si el SO verificó a la usuaria. */
export async function verifyLocalBiometric(
  rpId: string,
  ids: string[],
): Promise<boolean> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId,
      allowCredentials: ids.map((id) => ({
        type: "public-key" as const,
        id: b64urlToBytes(id),
      })),
      userVerification: "required",
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) return false;
  if (!ids.includes(cred.id)) return false;
  const response = cred.response as AuthenticatorAssertionResponse;
  return isUserVerified(response.authenticatorData);
}
