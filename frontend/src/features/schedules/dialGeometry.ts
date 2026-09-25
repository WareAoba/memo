export function point(minutes: number, radius: number) {
  const angle = (minutes / 1440) * Math.PI * 2;
  return { x: 180 + radius * Math.sin(angle), y: 180 - radius * Math.cos(angle) };
}
