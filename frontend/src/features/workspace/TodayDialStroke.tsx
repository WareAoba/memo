import { point } from '../schedules/dialGeometry';

// Shared geometry for visible strokes and their transparent separation masks.
export function TodayDialStroke({
  start,
  end,
  radius = 138,
  width,
  color,
  marker = false,
}: {
  start: number;
  end: number;
  radius?: number;
  width: number;
  color: string;
  marker?: boolean;
}) {
  if (marker) {
    const inner = point(start, 124),
      outer = point(start, 152);
    return (
      <line
        x1={inner.x}
        y1={inner.y}
        x2={outer.x}
        y2={outer.y}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
      />
    );
  }
  const circumference = 2 * Math.PI * radius;
  return (
    <circle
      cx="180"
      cy="180"
      r={radius}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeDasharray={`${Math.min(1, (end - start) / 1440) * circumference} ${circumference}`}
      strokeDashoffset={-(start / 1440) * circumference}
      transform="rotate(-90 180 180)"
    />
  );
}
