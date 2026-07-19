export default function CitasLoading() {
  return (
    <div className="pb-24">
      <div className="mb-4 flex items-center justify-between">
        <div className="bg-muted h-8 w-24 animate-pulse rounded" />
        <div className="bg-muted h-8 w-20 animate-pulse rounded" />
      </div>
      <div className="bg-muted mb-4 h-10 animate-pulse rounded-lg" />
      <div className="mb-4 flex gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="bg-muted h-16 flex-1 animate-pulse rounded-lg"
          />
        ))}
      </div>
      <ul className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="bg-muted h-20 animate-pulse rounded-xl" />
        ))}
      </ul>
    </div>
  );
}
