"use client";

import { Eye, EyeOff } from "lucide-react";
import * as React from "react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Campo de contraseña con botón de "ojo" para revelar/ocultar el texto. Envuelve
 * el `Input` base y alterna `type` entre password/text. Reserva espacio a la
 * derecha (`pr-10`) para el botón. El botón queda fuera del orden de tabulación
 * (`tabIndex=-1`) para no interferir con el flujo del formulario, y cambia su
 * `aria-label` según el estado. Acepta las mismas props que un `<input>` (menos
 * `type`), así funciona con `{...field}` de react-hook-form.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        className={cn("pr-10", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={show}
        tabIndex={-1}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute inset-y-0 right-0 flex items-center rounded-md px-3 outline-none focus-visible:ring-2"
      >
        {show ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
