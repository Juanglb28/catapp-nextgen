import {
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";

import { rpConfig } from "@/lib/app-lock";

import { listCredentials } from "./repository";
import { type WebauthnCredential } from "./schema";

function parseTransports(
  csv: string | null,
): AuthenticatorTransportFuture[] | undefined {
  if (!csv) return undefined;
  return csv.split(",").filter(Boolean) as AuthenticatorTransportFuture[];
}

/** Opciones para registrar una nueva credencial (huella/desbloqueo nativo). */
export async function registrationOptions(
  userId: string,
  userName: string,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const { rpName, rpID } = rpConfig();
  const existing = await listCredentials(userId);
  return generateRegistrationOptions({
    rpName,
    rpID,
    userName,
    userID: new TextEncoder().encode(userId),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: parseTransports(c.transports),
    })),
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "preferred",
      userVerification: "required",
    },
  });
}

/** Opciones para autenticar con una credencial ya registrada. */
export async function authenticationOptions(
  userId: string,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const { rpID } = rpConfig();
  const existing = await listCredentials(userId);
  return generateAuthenticationOptions({
    rpID,
    allowCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: parseTransports(c.transports),
    })),
    userVerification: "required",
  });
}

export type VerifiedCredential = {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string | null;
};

/** Verifica el registro; devuelve la credencial a persistir o null. */
export async function verifyRegistration(
  response: RegistrationResponseJSON,
  expectedChallenge: string,
): Promise<VerifiedCredential | null> {
  const { rpID, origin } = rpConfig();
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo) return null;

  const { credential } = verification.registrationInfo;
  return {
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: credential.transports?.length
      ? credential.transports.join(",")
      : null,
  };
}

/** Verifica la autenticación contra una credencial almacenada. */
export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
  cred: WebauthnCredential,
): Promise<{ newCounter: number } | null> {
  const { rpID, origin } = rpConfig();
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
    credential: {
      id: cred.credentialId,
      publicKey: new Uint8Array(Buffer.from(cred.publicKey, "base64url")),
      counter: cred.counter,
      transports: parseTransports(cred.transports),
    },
  });
  if (!verification.verified) return null;
  return { newCounter: verification.authenticationInfo.newCounter };
}
