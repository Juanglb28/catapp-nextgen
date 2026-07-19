"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";

import { MoneyInput } from "@/components/money-input";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { createServiceAction, updateServiceAction } from "../actions";
import {
  emptyServiceForm,
  type ServiceFormInput,
  serviceFormSchema,
} from "../validation";

type Props = {
  trigger: ReactNode;
  /** Si viene, el sheet edita ese servicio; si no, crea uno nuevo. */
  service?: { id: string; values: ServiceFormInput };
};

/** Hoja (sheet) mobile-first para crear o editar un servicio. */
export function ServiceSheet({ trigger, service }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const isEdit = service !== undefined;

  const form = useForm<ServiceFormInput>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: service?.values ?? emptyServiceForm,
  });

  async function onSubmit(values: ServiceFormInput) {
    setServerError(null);
    const result = isEdit
      ? await updateServiceAction(service.id, values)
      : await createServiceAction(values);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    setOpen(false);
    if (!isEdit) form.reset(emptyServiceForm);
    router.refresh();
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setServerError(null);
      form.reset(service?.values ?? emptyServiceForm);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Editar servicio" : "Nuevo servicio"}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Actualiza el nombre, precio o duración."
              : "Agrega un servicio a tu catálogo."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 px-4 pb-6"
            noValidate
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Manicure semipermanente"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="basePriceCop"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Precio</FormLabel>
                  <FormControl>
                    <MoneyInput
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                    />
                  </FormControl>
                  <FormDescription>En pesos colombianos.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="durationMin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duración (minutos)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={5}
                      value={field.value}
                      onBlur={field.onBlur}
                      name={field.name}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? 0 : Number(e.target.value),
                        )
                      }
                    />
                  </FormControl>
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
              {form.formState.isSubmitting
                ? "Guardando…"
                : isEdit
                  ? "Guardar cambios"
                  : "Agregar servicio"}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
