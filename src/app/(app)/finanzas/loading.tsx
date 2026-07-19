export default function FinanzasLoading() {
  return (
    <div className="space-y-5 pb-24">
      <h1 className="text-2xl font-semibold tracking-tight">Finanzas</h1>
      <div className="bg-muted h-8 w-full animate-pulse rounded" />
      <div className="bg-muted h-28 animate-pulse rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted h-16 animate-pulse rounded-xl" />
        <div className="bg-muted h-16 animate-pulse rounded-xl" />
      </div>
      <div className="bg-muted h-32 animate-pulse rounded-xl" />
      <ul className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="bg-muted h-10 animate-pulse rounded-xl" />
        ))}
      </ul>
    </div>
  );
}
