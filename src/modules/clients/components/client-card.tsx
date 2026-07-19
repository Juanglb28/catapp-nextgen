import { Phone } from "lucide-react";
import Link from "next/link";

import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { formatPhoneCO, telLink, whatsappLink } from "@/lib/phone";

import { type Client } from "../schema";

/** Gradientes rotativos para los avatares de clientas (igual que el mockup). */
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#10B981,#0EA5E9)", // brand ocean
  "linear-gradient(135deg,#9B7DD4,#7B5DB4)", // purple
  "linear-gradient(135deg,#5BB8A0,#3D9880)", // teal
  "linear-gradient(135deg,#D4A843,#B08828)", // gold
];

function avatarGradient(name: string): string {
  const code = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[code % AVATAR_GRADIENTS.length]!;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Tarjeta de clienta: avatar gradiente + nombre + teléfono y atajos para llamar / WhatsApp. */
export function ClientCard({ client }: { client: Client }) {
  return (
    <li className="bg-card flex items-center gap-3 rounded-xl border px-3 py-2.5">
      {/* Avatar */}
      <Link
        href={`/clientas/${client.id}`}
        aria-label={`Ver perfil de ${client.name}`}
        className="shrink-0"
        tabIndex={-1}
      >
        <div
          className="flex size-10 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ background: avatarGradient(client.name) }}
          aria-hidden
        >
          {initials(client.name)}
        </div>
      </Link>

      {/* Info */}
      <Link href={`/clientas/${client.id}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{client.name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {formatPhoneCO(client.phone)}
        </p>
      </Link>

      {/* Acciones */}
      <a
        href={telLink(client.phone)}
        aria-label={`Llamar a ${client.name}`}
        className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-9 items-center justify-center rounded-full"
      >
        <Phone className="size-4" aria-hidden />
      </a>
      <a
        href={whatsappLink(client.phone)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`WhatsApp a ${client.name}`}
        className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-9 items-center justify-center rounded-full"
      >
        <WhatsAppIcon className="size-4" aria-hidden />
      </a>
    </li>
  );
}
