"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTenant } from "@/modules/tenancy/actions";
import {
  onboardingSchema,
  type OnboardingInput,
  TENANT_TIMEZONES,
} from "@/modules/tenancy/onboarding-validation";

const TZ_LABELS: Record<(typeof TENANT_TIMEZONES)[number], string> = {
  "America/Bogota": "Bogotá (Colombia)",
  "America/Lima": "Lima (Perú)",
  "America/Mexico_City": "Ciudad de México",
  "America/Santiago": "Santiago (Chile)",
  "America/Argentina/Buenos_Aires": "Buenos Aires (Argentina)",
};

export function OnboardingForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      businessName: "",
      phone: "",
      timezone: "America/Bogota",
      createSampleServices: true,
    },
  });

  async function onSubmit(values: OnboardingInput) {
    setServerError(null);
    const result = await createTenant(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    router.push("/citas");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        <FormField
          control={form.control}
          name="businessName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del negocio</FormLabel>
              <FormControl>
                <Input placeholder="Uñas de Susana" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>WhatsApp del negocio</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+57 300 123 4567"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Celular colombiano; lo usarás para escribir a tus clientas.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Zona horaria</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {TENANT_TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {TZ_LABELS[tz]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="createSampleServices"
          render={({ field }) => (
            <FormItem>
              <label className="flex items-start gap-3 rounded-xl border p-3">
                <FormControl>
                  <input
                    type="checkbox"
                    className="accent-primary mt-0.5 size-4"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    onBlur={field.onBlur}
                    name={field.name}
                  />
                </FormControl>
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">
                    Crear servicios de ejemplo
                  </span>
                  <span className="text-muted-foreground block text-sm">
                    Manicure, semipermanente, acrílicas y pedicure. Podrás
                    editarlos o eliminarlos después.
                  </span>
                </span>
              </label>
              <FormMessage />
            </FormItem>
          )}
        />
        {serverError ? (
          <p className="text-destructive text-sm" role="alert">
            {serverError}
          </p>
        ) : null}
        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Creando negocio…" : "Empezar"}
        </Button>
      </form>
    </Form>
  );
}
