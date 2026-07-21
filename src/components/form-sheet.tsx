"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import {
  type DefaultValues,
  type FieldValues,
  type Resolver,
  type UseFormReturn,
  useForm,
} from "react-hook-form";
import type { ZodType } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Estado y flujo comunes de un sheet-con-formulario (B4/R-C2). Deduplica el
 * patrón repetido en ~15 sheets: `useForm` + validación Zod + estado de error de
 * servidor + submit que llama la action, muestra el error o cierra/resetea/
 * refresca. La action se pasa ya cerrada sobre sus argumentos (create vs edit lo
 * decide el sheet), así que este hook no conoce la firma concreta.
 */
export function useActionForm<TValues extends FieldValues>(opts: {
  schema: ZodType<TValues>;
  defaultValues: TValues;
  action: (values: TValues) => Promise<ActionResult<unknown>>;
  /** Valores a los que resetear tras éxito; si se omite, no resetea. */
  resetOnSuccess?: TValues;
  /**
   * Callback opcional tras un éxito, con el resultado y los valores enviados.
   * Devolver `true` significa "ya lo manejé, no hagas `router.refresh()`" (p. ej.
   * cuando quien usa el sheet quiere reaccionar sin recargar la página).
   */
  onSuccess?: (
    result: { ok: true; data?: unknown },
    values: TValues,
  ) => boolean | void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<TValues>({
    // `zodResolver` no acepta `ZodType<TValues>` genérico (input `unknown` en
    // zod v4); casteamos el argumento y el resultado al tipo del formulario.
    resolver: zodResolver(
      opts.schema as unknown as Parameters<typeof zodResolver>[0],
    ) as unknown as Resolver<TValues>,
    defaultValues: opts.defaultValues as DefaultValues<TValues>,
  });

  async function onSubmit(values: TValues) {
    setServerError(null);
    const result = await opts.action(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    setOpen(false);
    if (opts.resetOnSuccess)
      form.reset(opts.resetOnSuccess as DefaultValues<TValues>);
    const handled = opts.onSuccess?.(result, values);
    if (handled !== true) router.refresh();
  }

  /** Al abrir, limpia el error y resetea el formulario a sus valores iniciales. */
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setServerError(null);
      form.reset(opts.defaultValues as DefaultValues<TValues>);
    }
  }

  return { form, open, setOpen, onOpenChange, serverError, onSubmit };
}

type FormSheetProps<TValues extends FieldValues> = {
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  submitLabel: string;
  submittingLabel?: string;
  form: UseFormReturn<TValues>;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  serverError: string | null;
  onSubmit: (values: TValues) => void | Promise<void>;
  children: ReactNode;
};

/**
 * Envoltorio mobile-first de un sheet-con-formulario: Sheet + header + `<Form>` +
 * el error de servidor + el botón de submit. Los campos se pasan como `children`.
 * Se usa junto con `useActionForm`.
 */
export function FormSheet<TValues extends FieldValues>({
  trigger,
  title,
  description,
  submitLabel,
  submittingLabel = "Guardando…",
  form,
  open,
  onOpenChange,
  serverError,
  onSubmit,
  children,
}: FormSheetProps<TValues>) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : null}
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 px-4 pb-6"
            noValidate
          >
            {children}

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
              {form.formState.isSubmitting ? submittingLabel : submitLabel}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
