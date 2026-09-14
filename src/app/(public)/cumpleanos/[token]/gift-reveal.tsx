"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type Phase = "closed" | "opening" | "open";

type ConfettiPiece = {
  id: number;
  gx: number; // desplazamiento horizontal final (px)
  gy: number; // desplazamiento vertical final (px)
  grot: number; // rotación final (deg)
  delay: number; // ms
  duration: number; // ms
  color: string;
  size: number;
  round: boolean;
};

const CONFETTI_COLORS = [
  "#f9a8d4",
  "#f472b6",
  "#e879f9",
  "#c084fc",
  "#a78bfa",
  "#fbbf24",
  "#60a5fa",
  "#ffffff",
];

function randomColor(): string {
  return (
    CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)] ??
    "#ffffff"
  );
}

function buildConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    gx: Math.round((Math.random() - 0.5) * 260),
    gy: Math.round(90 + Math.random() * 160),
    grot: Math.round(
      (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 420),
    ),
    delay: Math.round(Math.random() * 150),
    duration: Math.round(900 + Math.random() * 500),
    color: randomColor(),
    size: Math.random() > 0.5 ? 8 : 5,
    round: Math.random() > 0.5,
  }));
}

/**
 * Experiencia inmersiva de apertura del regalo de cumpleaños (D-30): caja
 * cerrada → tap → confeti + tapa que se abre → se revela `children` (el
 * saludo + selección de servicio, sin cambios de lógica). Todo dibujado a
 * mano con SVG/CSS (sin librerías de confeti/animación), igual que el
 * precedente de D-15/D-16. Respeta `prefers-reduced-motion` saltando directo
 * a `children`.
 */
export function GiftReveal({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("closed");
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleOpen() {
    if (phase !== "closed") return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setPhase("open");
      return;
    }
    setConfetti(buildConfetti(28));
    setPhase("opening");
    timeoutRef.current = setTimeout(() => setPhase("open"), 1000);
  }

  if (phase === "open") {
    return (
      <div className="animate-gift-fade-in flex flex-1 flex-col">
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-1">
        <p className="text-lg font-bold tracking-wide text-white">Cat App</p>
        <p className="text-xs text-white/60">Belleza en tus manos</p>
      </div>

      <button
        type="button"
        onClick={handleOpen}
        aria-label="Toca para abrir tu regalo"
        className="relative w-40 rounded-2xl border-0 bg-transparent p-0 focus-visible:ring-4 focus-visible:ring-pink-300/60 focus-visible:outline-none"
      >
        {confetti.map((c) => (
          <span
            key={c.id}
            aria-hidden
            className="pointer-events-none absolute top-[38%] left-1/2"
            style={
              {
                width: c.size,
                height: c.size,
                backgroundColor: c.color,
                borderRadius: c.round ? "9999px" : "2px",
                "--gx": `${c.gx}px`,
                "--gy": `${c.gy}px`,
                "--grot": `${c.grot}deg`,
                animation: `gift-confetti ${c.duration}ms ease-out ${c.delay}ms forwards`,
              } as CSSProperties
            }
          />
        ))}

        <GiftBoxArt phase={phase} />
      </button>

      {phase === "closed" && (
        <p className="text-sm font-medium text-white/80">
          Toca para abrir tu regalo
        </p>
      )}
    </div>
  );
}

function GiftBoxArt({ phase }: { phase: Phase }) {
  return (
    <svg
      viewBox="0 0 180 170"
      aria-hidden
      className={[
        "aspect-[180/170] w-full drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]",
        phase === "closed" ? "animate-gift-idle" : "",
      ].join(" ")}
    >
      <ellipse cx="90" cy="158" rx="52" ry="7" fill="#000000" opacity="0.25" />
      <rect x="32" y="72" width="116" height="76" rx="10" fill="#7c3aed" />
      <rect x="78" y="72" width="24" height="76" fill="#f472b6" />
      <g
        style={
          phase === "opening"
            ? ({
                animation: "gift-lid-pop 0.6s ease-in forwards",
                transformOrigin: "90px 76px",
              } as CSSProperties)
            : undefined
        }
      >
        <rect x="24" y="52" width="132" height="24" rx="8" fill="#a855f7" />
        <rect x="78" y="52" width="24" height="24" fill="#f9a8d4" />
        <circle cx="78" cy="48" r="13" fill="#f9a8d4" />
        <circle cx="102" cy="48" r="13" fill="#f9a8d4" />
        <circle cx="90" cy="46" r="8" fill="#ec4899" />
      </g>
    </svg>
  );
}
