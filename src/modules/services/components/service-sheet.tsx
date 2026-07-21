"use client";

import { type ReactNode } from "react";

import { FormSheet, useActionForm } from "@/components/form-sheet";
import { MoneyInput } from "@/components/money-input";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

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
  const isEdit = service !== undefined;

  const { form, open, onOpenChange, serverError, onSubmit } =
    useActionForm<ServiceFormInput>({
      schema: serviceFormSchema,
      defaultValues: service?.values ?? emptyServiceForm,
      action: (values) =>
        isEdit
          ? updateServiceAction(service.id, values)
          : createServiceAction(values),
      resetOnSuccess: isEdit ? undefined : emptyServiceForm,
    });

  return (
    <FormSheet
      trigger={trigger}
      title={isEdit ? "Editar servicio" : "Nuevo servicio"}
      description={
        isEdit
          ? "Actualiza el nombre, precio o duración."
          : "Agrega un servicio a tu catálogo."
      }
      submitLabel={isEdit ? "Guardar cambios" : "Agregar servicio"}
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      serverError={serverError}
      onSubmit={onSubmit}
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
    </FormSheet>
  );
}
