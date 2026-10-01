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
    setConfetti(buildConfetti(42));
    setPhase("opening");
    timeoutRef.current = setTimeout(() => setPhase("open"), 3450);
  }

  if (phase === "open") {
    return (
      <div className="relative flex min-h-[calc(100dvh-4rem)] flex-1 flex-col overflow-hidden">
        <GiftAtmosphere />
        <div className="animate-gift-fade-in relative z-10 flex flex-1 flex-col">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] flex-1 flex-col overflow-hidden px-6 text-center">
      <GiftAtmosphere />
      <div className="absolute top-16 left-0 z-20 w-full space-y-1">
        <p className="text-[1.7rem] font-extrabold leading-none tracking-[-.06em] text-white">CatApp</p>
        <p className="text-[.96rem] text-pink-100/80">Belleza en tus manos</p>
      </div>

      {phase === "opening" && (
        <>
          <div className="absolute top-[36%] left-1/2 z-20 size-48 -translate-x-1/2 animate-[gift-cat-arrival_.68s_cubic-bezier(.16,.9,.25,1)_.34s_both] drop-shadow-[0_10px_14px_rgba(17,0,32,.53)]">
            <Image src="/Icon_S.png" alt="" width={192} height={192} priority className="size-full object-contain" />
          </div>
          <CelebrationDecor />
        </>
      )}

      <button
        type="button"
        onClick={handleOpen}
        aria-label="Toca para abrir tu regalo"
        className="absolute bottom-12 left-1/2 z-10 w-40 -translate-x-1/2 rounded-2xl border-0 bg-transparent p-0 focus-visible:ring-4 focus-visible:ring-pink-300/60 focus-visible:outline-none"
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
        <p className="absolute bottom-4 left-0 z-20 w-full text-sm font-medium text-white/80 animate-pulse">
          Toca para abrir tu regalo
        </p>
      )}
    </div>
  );
}

function GiftAtmosphere() {
  return (
    <>
      <div aria-hidden className="birthday-gift-orb birthday-gift-orb-one" />
      <div aria-hidden className="birthday-gift-orb birthday-gift-orb-two" />
      <div aria-hidden className="birthday-gift-stars">✦　·　✦　·　✦</div>
      <style jsx global>{`
        .birthday-gift-orb { position: absolute; z-index: 0; border-radius: 9999px; filter: blur(20px); pointer-events: none; }
        .birthday-gift-orb-one { top: -95px; right: -95px; width: 230px; height: 230px; background: #a855f7; opacity: .7; animation: birthday-orb-one 12s ease-in-out infinite alternate; }
        .birthday-gift-orb-two { bottom: -80px; left: -90px; width: 200px; height: 200px; background: #ec4899; opacity: .35; animation: birthday-orb-two 15s ease-in-out infinite alternate; }
        .birthday-gift-stars { position: absolute; top: 48px; z-index: 1; width: 100%; color: rgb(240 171 252 / .67); font-size: 1.35rem; letter-spacing: 1.4rem; text-align: center; pointer-events: none; }
        @keyframes birthday-orb-one { to { transform: translate(-28px, 46px) scale(1.16); } }
        @keyframes birthday-orb-two { to { transform: translate(42px, -37px) scale(1.2); } }
        @keyframes gift-cat-arrival { from { opacity: 0; transform: translate(-50%, 18px) scale(.82); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
      `}</style>
    </>
  );
}

function CelebrationDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-15">
      <span className="birthday-symbol birthday-cake">🎂</span>
      <span className="birthday-symbol birthday-heart">💗</span>
      <span className="birthday-symbol birthday-star">✦</span>
      <span className="birthday-symbol birthday-balloon">🎈</span>
      <span className="birthday-symbol birthday-sparkle">✨</span>
      <span className="birthday-spark">✦</span>
      <div className="birthday-paw-trail">
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index}>🐾</span>
        ))}
      </div>
      <style jsx global>{`
        .birthday-symbol { position: absolute; z-index: 15; font-size: 1.69rem; font-style: normal; opacity: 0; animation: birthday-pop-symbol .72s cubic-bezier(.15,.9,.25,1) forwards; }
        .birthday-cake { top: 39%; left: 12%; animation-delay: .1s; }.birthday-heart { top: 42%; right: 10%; animation-delay: .18s; }.birthday-star { top: 22%; left: 18%; animation-delay: .25s; }.birthday-balloon { top: 27%; right: 17%; animation-delay: .33s; }.birthday-sparkle { top: 40%; left: 43%; animation-delay: .14s; }
        .birthday-spark { position: absolute; top: 45%; left: calc(50% - 27px); z-index: 15; color: #fef08a; font-size: 3.75rem; opacity: 0; animation: birthday-spark .7s ease-out forwards; }
        .birthday-paw-trail span { position: absolute; z-index: 15; font-size: 1.82rem; font-style: normal; opacity: 0; filter: brightness(.52) saturate(.9) contrast(1.15); animation: birthday-paw-rise .48s ease-out forwards; }
        .birthday-paw-trail span:nth-child(1) { bottom: 12%; left: 47%; animation-delay: .05s; }.birthday-paw-trail span:nth-child(2) { bottom: 16%; left: 55%; animation-delay: .13s; }.birthday-paw-trail span:nth-child(3) { bottom: 20%; left: 48%; animation-delay: .21s; }.birthday-paw-trail span:nth-child(4) { bottom: 24%; left: 55%; animation-delay: .29s; }.birthday-paw-trail span:nth-child(5) { bottom: 28%; left: 49%; animation-delay: .37s; }.birthday-paw-trail span:nth-child(6) { bottom: 32%; left: 53%; animation-delay: .45s; }
        @keyframes birthday-pop-symbol { 0% { opacity: 0; transform: scale(.2) rotate(-25deg); } 65% { opacity: 1; transform: scale(1.18) rotate(10deg); } 100% { opacity: .92; transform: scale(1) rotate(0); } }
        @keyframes birthday-spark { 40% { opacity: 1; transform: scale(1.5); } 100% { opacity: 0; transform: scale(2.2); } }
        @keyframes birthday-paw-rise { to { opacity: .9; transform: scale(1) rotate(-15deg); } }
      `}</style>
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
