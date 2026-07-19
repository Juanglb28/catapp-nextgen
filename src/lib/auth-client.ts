import { createAuthClient } from "better-auth/react";

// baseURL se infiere del origen actual en el navegador (same-origin).
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
