export default function InventarioLoading() {
  return (
    <div className="pb-24">
      <div className="mb-4 flex items-center justify-between">
        <div className="bg-muted h-8 w-32 animate-pulse rounded" />
        <div className="bg-muted h-8 w-20 animate-pulse rounded" />
      </div>
      <div className="bg-muted mb-3 h-10 animate-pulse rounded-lg" />
      <div className="bg-muted mb-4 h-7 w-32 animate-pulse rounded-full" />
      <ul className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="bg-muted h-16 animate-pulse rounded-xl" />
        ))}
      </ul>
    </div>
  );
}
