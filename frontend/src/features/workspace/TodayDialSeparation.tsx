import { memo } from 'react';
import { TodayDialStroke } from './TodayDialStroke';
import { dialBorderWidth, dialStrokeGeometry, type DialRange } from './todayDialLayout';

// Arc outlines only cut solid arcs. Foreground markers cut their full silhouette
// out of both arc layers, while remaining continuous and unmasked themselves.
export const TodayDialSeparation = memo(function TodayDialSeparation({
  id,
  ranges,
}: {
  id: string;
  ranges: DialRange[];
}) {
  const shapes = ranges
    .filter((range) => !range.tail)
    .map((range) => {
      const marker = !range.item.end_time;
      const geometry = marker ? { radius: 138, width: 4 } : dialStrokeGeometry(range.parts[0]!);
      const tail = ranges.find((other) => other.tail && other.item.id === range.item.id);
      return { ...geometry, marker, start: range.start, end: range.end + (tail?.end ?? 0) };
    });
  return (
    <>
      {shapes.map(
        (shape, index) =>
          !shape.marker && (
            <mask
              key={index}
              id={`${id}-outline-${index}`}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="360"
              height="360"
            >
              <TodayDialStroke {...shape} color="white" width={shape.width + 2 * dialBorderWidth} />
              <TodayDialStroke {...shape} color="black" />
            </mask>
          ),
      )}
      {['arcs', 'markers'].map((layer) => (
        <mask
          key={layer}
          id={layer === 'arcs' ? id : `${id}-markers`}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="360"
          height="360"
        >
          <rect width="360" height="360" fill="white" />
          {shapes.map((shape, index) =>
            shape.marker ? (
              <TodayDialStroke
                key={index}
                {...shape}
                color="black"
                width={shape.width + 2 * dialBorderWidth}
              />
            ) : layer === 'arcs' ? (
              <rect
                key={index}
                width="360"
                height="360"
                fill="black"
                mask={`url(#${id}-outline-${index})`}
              />
            ) : null,
          )}
        </mask>
      ))}
    </>
  );
});
