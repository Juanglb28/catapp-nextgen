"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // localStorage no disponible: el tema no persiste, sin romper la UI.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      className="hover:bg-accent flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left"
    >
      {dark ? (
        <Moon className="text-muted-foreground size-5 shrink-0" aria-hidden />
      ) : (
        <Sun className="text-muted-foreground size-5 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium">Modo oscuro</p>
        <p className="text-muted-foreground text-sm">
          {dark ? "Activado" : "Desactivado"}
        </p>
      </div>
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          dark ? "bg-primary" : "bg-input"
        }`}
      >
        <span
          className={`inline-block size-5 transform rounded-full bg-white shadow transition-transform ${
            dark ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
