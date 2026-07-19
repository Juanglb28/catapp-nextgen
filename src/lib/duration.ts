/** Formatea minutos a texto legible: 45 -> "45 min", 90 -> "1 h 30 min". */
export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  const minutes = min % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}
