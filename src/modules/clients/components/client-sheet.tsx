"use client";

import { type ReactNode } from "react";

import { FormSheet, useActionForm } from "@/components/form-sheet";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { createClientAction, updateClientAction } from "../actions";
import {
  type ClientFormInput,
  clientFormSchema,
  emptyClientForm,
} from "../validation";

type Props = {
  trigger: ReactNode;
  /** Si viene, el sheet edita esa clienta; si no, crea una nueva. */
  client?: { id: string; values: ClientFormInput };
  /**
   * Al crear, en vez de refrescar la página, notifica a quien la usa (p. ej. el
   * flujo de cita selecciona la clienta recién creada sin perder el formulario).
   */
  onCreated?: (created: { id: string; name: string }) => void;
};

/** Hoja (sheet) mobile-first para crear o editar una clienta. */
export function ClientSheet({ trigger, client, onCreated }: Props) {
  const isEdit = client !== undefined;

  const { form, open, onOpenChange, serverError, onSubmit } =
    useActionForm<ClientFormInput>({
      schema: clientFormSchema,
      defaultValues: client?.values ?? emptyClientForm,
      action: (values) =>
        isEdit
          ? updateClientAction(client.id, values)
          : createClientAction(values),
      resetOnSuccess: isEdit ? undefined : emptyClientForm,
      onSuccess: (result, values) => {
        // Al crear con `onCreated`, notifica al padre y evita el refresh (el
        // flujo de cita quiere la clienta recién creada sin recargar).
        if (!isEdit && onCreated && result.data) {
          onCreated({ id: (result.data as { id: string }).id, name: values.name });
          return true; // no refrescar
        }
      },
    });

  return (
    <FormSheet
      trigger={trigger}
      title={isEdit ? "Editar clienta" : "Nueva clienta"}
      description={
        isEdit
          ? "Actualiza los datos de tu clienta."
          : "Registra a tu clienta para llevar su contacto e historial."
      }
      submitLabel={isEdit ? "Guardar cambios" : "Registrar clienta"}
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
              <Input placeholder="Susana Gómez" autoFocus {...field} />
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
            <FormLabel>Celular / WhatsApp</FormLabel>
            <FormControl>
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+57 300 123 4567"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Correo <span className="text-muted-foreground">(opcional)</span>
            </FormLabel>
            <FormControl>
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="susana@correo.com"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="birthdayDate"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Fecha de cumpleaños{" "}
              <span className="text-muted-foreground">(opcional)</span>
            </FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Notas <span className="text-muted-foreground">(opcional)</span>
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="Alergias, preferencias, color favorito…"
                rows={3}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </FormSheet>
  );
}
