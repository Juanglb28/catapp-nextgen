"use client";

import Image from "next/image";
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
    gx: Math.round((Math.random() - 0.5) * 360),
    gy: Math.round(110 + Math.random() * 250),
    grot: Math.round(
      (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 420),
    ),
    delay: Math.round(Math.random() * 400),
    duration: Math.round(1200 + Math.random() * 1500),
    color: randomColor(),
    size: Math.random() > 0.5 ? 10 : 7,
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
      exitFullscreen();
    };
  }, []);

  // La animación se ve a pantalla completa (sin barra de URL); al revelar la
  // selección se vuelve a la vista normal.
  useEffect(() => {
    if (phase === "open") exitFullscreen();
  }, [phase]);

  function handleOpen() {
    if (phase !== "closed") return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setPhase("open");
      return;
    }
    enterFullscreen();
    setConfetti(buildConfetti(42));
    setPhase("opening");
    timeoutRef.current = setTimeout(() => setPhase("open"), 3450);
  }

  if (phase === "open") {
    return (
      <>
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 overflow-hidden"
        >
          <GiftAtmosphere />
        </div>
        <div className="animate-gift-fade-in relative z-10 flex flex-1 flex-col">
          {children}
        </div>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-10 overflow-hidden text-center">
      <GiftAtmosphere />
      <div className="relative mx-auto h-full w-full max-w-md">
        <div className="absolute top-16 left-0 z-20 w-full space-y-1">
          <p className="text-[1.825rem] leading-none font-extrabold tracking-[-.06em] text-white">
            CatApp
          </p>
          <p className="text-[1.085rem] text-pink-100/80">
            Belleza en tus manos
          </p>
        </div>

        {phase === "opening" && (
          <>
            <div className="absolute top-[36%] left-1/2 z-20 size-48 -translate-x-1/2 animate-[gift-cat-arrival_.68s_cubic-bezier(.16,.9,.25,1)_.34s_both] drop-shadow-[0_10px_14px_rgba(17,0,32,.53)]">
              <Image
                src="/Icon_S.png"
                alt=""
                width={192}
                height={192}
                priority
                className="size-full object-contain"
              />
            </div>
            <CelebrationDecor />
          </>
        )}

        <button
          type="button"
          onClick={handleOpen}
          aria-label="Toca para abrir tu regalo"
          className="absolute bottom-12 left-1/2 z-10 w-52 -translate-x-1/2 rounded-2xl border-0 bg-transparent p-0 focus-visible:ring-4 focus-visible:ring-pink-300/60 focus-visible:outline-none"
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
          <p className="absolute bottom-4 left-0 z-20 w-full animate-pulse text-sm font-medium text-white/80">
            Toca para abrir tu regalo
          </p>
        )}
      </div>
    </div>
  );
}

function enterFullscreen() {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (document.fullscreenElement || typeof el.requestFullscreen !== "function")
    return;
  // En iOS Safari no existe para páginas: se ignora y la animación sigue igual.
  el.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
}

function exitFullscreen() {
  if (typeof document === "undefined" || !document.fullscreenElement) return;
  document.exitFullscreen().catch(() => {});
}

function GiftAtmosphere() {
  return (
    <>
      <div aria-hidden className="birthday-gift-orb birthday-gift-orb-one" />
      <div aria-hidden className="birthday-gift-orb birthday-gift-orb-two" />
      <div aria-hidden className="birthday-gift-stars">
        ✦　·　✦　·　✦
      </div>
    </>
  );
}

type DecorSymbol = {
  emoji: string;
  top: string;
  left: string;
  delay: number; // s
  color?: string;
};

/** 4 globos, 3 corazones y 7 estrellas, repartidos alrededor del gato. */
const DECOR_SYMBOLS: DecorSymbol[] = [
  { emoji: "🎈", top: "24%", left: "6%", delay: 0.1 },
  { emoji: "🎈", top: "30%", left: "80%", delay: 0.22 },
  { emoji: "🎈", top: "60%", left: "4%", delay: 0.34 },
  { emoji: "🎈", top: "56%", left: "84%", delay: 0.46 },
  { emoji: "💗", top: "40%", left: "8%", delay: 0.18 },
  { emoji: "💗", top: "43%", left: "82%", delay: 0.3 },
  { emoji: "💗", top: "74%", left: "6%", delay: 0.52 },
  { emoji: "✦", top: "19%", left: "22%", delay: 0.25, color: "#f0abfc" },
  { emoji: "✨", top: "21%", left: "72%", delay: 0.14 },
  { emoji: "✦", top: "27%", left: "46%", delay: 0.38, color: "#fef08a" },
  { emoji: "✨", top: "50%", left: "6%", delay: 0.42 },
  { emoji: "✦", top: "66%", left: "84%", delay: 0.2, color: "#f9a8d4" },
  { emoji: "✨", top: "78%", left: "82%", delay: 0.56 },
  { emoji: "✦", top: "84%", left: "8%", delay: 0.32, color: "#ffffff" },
];

function CelebrationDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-15">
      {DECOR_SYMBOLS.map((d, index) => (
        <span
          key={index}
          className="birthday-symbol"
          style={{
            top: d.top,
            left: d.left,
            animationDelay: `${d.delay}s`,
            color: d.color,
          }}
        >
          {d.emoji}
        </span>
      ))}
      <span className="birthday-spark">✦</span>
      <div className="birthday-paw-trail">
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index}>🐾</span>
        ))}
      </div>
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
