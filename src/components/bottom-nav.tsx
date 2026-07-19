"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Cake,
  CalendarDays,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const items: NavItem[] = [
  { href: "/citas", label: "Citas", icon: CalendarDays },
  { href: "/clientas", label: "Clientas", icon: Users },
  { href: "/cumpleanos", label: "Cumpleaños", icon: Cake },
  { href: "/finanzas", label: "Finanzas", icon: Wallet },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export function BottomNav({ birthdayCount = 0 }: { birthdayCount?: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="bg-background fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "relative flex size-9 items-center justify-center rounded-xl transition-colors",
                    active && "bg-cyan-100",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {href === "/cumpleanos" && birthdayCount > 0 ? (
                    <span
                      aria-label={`${birthdayCount} bono${birthdayCount !== 1 ? "s" : ""} pendiente${birthdayCount !== 1 ? "s" : ""}`}
                      className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-pink-500 px-1 text-[9px] font-bold text-white"
                    >
                      {birthdayCount > 9 ? "9+" : birthdayCount}
                    </span>
                  ) : null}
                </span>
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
