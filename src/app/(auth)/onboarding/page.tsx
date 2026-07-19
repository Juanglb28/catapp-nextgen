import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { OnboardingForm } from "@/modules/tenancy/components/onboarding-form";
import { getUserTenant } from "@/modules/tenancy/repository";

export const metadata: Metadata = { title: "Configura tu negocio" };

export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }
  // Si ya tiene negocio, no repetir el onboarding.
  const existing = await getUserTenant(session.user.id);
  if (existing) {
    redirect("/citas");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Configura tu negocio
        </h1>
        <p className="text-muted-foreground text-sm">
          Un último paso para empezar a usar CatApp.
        </p>
      </div>
      <OnboardingForm />
    </div>
  );
}
