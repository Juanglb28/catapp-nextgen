export function LoadingScreen({ message = "Cargando…" }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-7 bg-black px-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/icon-512.png"
        alt="CatApp"
        width={160}
        height={160}
        className="rounded-[28px]"
      />

      <div>
        <h1
          className="text-3xl font-medium tracking-tight"
          style={{
            color: "#22d3ee",
            textShadow: "0 0 18px rgba(34, 211, 238, 0.45)",
          }}
        >
          CatApp
        </h1>
        <p className="mt-1 text-xs text-neutral-400">Cat app</p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div
          className="size-8 animate-spin rounded-full border-[3px]"
          style={{
            borderColor: "rgba(34, 211, 238, 0.18)",
            borderTopColor: "#22d3ee",
          }}
          role="status"
          aria-label="Cargando"
        />
        <p className="text-sm text-neutral-300">{message}</p>
      </div>
    </div>
  );
}
