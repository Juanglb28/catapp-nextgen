"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const isEdit = client !== undefined;

  const form = useForm<ClientFormInput>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: client?.values ?? emptyClientForm,
  });

  async function onSubmit(values: ClientFormInput) {
    setServerError(null);
    const result = isEdit
      ? await updateClientAction(client.id, values)
      : await createClientAction(values);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    setOpen(false);
    if (!isEdit) {
      if (onCreated && "data" in result) {
        onCreated({ id: result.data.id, name: values.name });
        form.reset(emptyClientForm);
        return;
      }
      form.reset(emptyClientForm);
    }
    router.refresh();
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setServerError(null);
      form.reset(client?.values ?? emptyClientForm);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar clienta" : "Nueva clienta"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Actualiza los datos de tu clienta."
              : "Registra a tu clienta para llevar su contacto e historial."}
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
                    Correo{" "}
                    <span className="text-muted-foreground">(opcional)</span>
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
                    Notas{" "}
                    <span className="text-muted-foreground">(opcional)</span>
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
                  : "Registrar clienta"}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
