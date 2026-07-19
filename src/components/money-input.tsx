"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { formatCOP } from "@/lib/money";

type Props = Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
  /** Valor en pesos (entero). */
  value: number;
  /** Devuelve el valor en pesos (entero) mientras se escribe. */
  onChange: (value: number) => void;
};

/**
 * Campo de dinero es-CO. Muestra el valor formateado ($50.000) mientras se
 * escribe y entrega un entero de pesos. Reutilizable (servicios, citas).
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, Props>(
  function MoneyInput({ value, onChange, ...props }, ref) {
    const display = value > 0 ? formatCOP(BigInt(Math.trunc(value))) : "";

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const digits = e.target.value.replace(/\D/g, "");
      onChange(digits ? Number(digits) : 0);
    }

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="$0"
        value={display}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
