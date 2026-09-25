import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { point } from './dialGeometry';
function DaySymbol({ kind }: { kind: 'midnight' | 'noon' }) {
  useTranslation();
  return (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === 'midnight' ? (
        <path d="M5 -8 A9 9 0 1 0 8 5 A8 8 0 0 1 5 -8Z" />
      ) : (
        <>
          <circle r="4" />
          <path d="M0 -10v2 M0 8v2 M-10 0h2 M8 0h2 M-7 -7l1.5 1.5 M5.5 5.5L7 7 M-7 7l1.5 -1.5 M5.5 -5.5L7 -7" />
        </>
      )}
    </g>
  );
}
export function DialFace() {
  useTranslation();
  return (
    <>
      {Array.from({ length: 48 }, (_, i) => {
        if ([0, 1, 23].includes(i % 24)) return null;
        const outer = point(i * 30, 116),
          inner = point(i * 30, i % 2 === 0 ? 106 : 112);
        return (
          <line
            key={i}
            x1={outer.x}
            y1={outer.y}
            x2={inner.x}
            y2={inner.y}
            className={i % 2 === 0 ? 'hour-tick' : 'minor-tick'}
          />
        );
      })}
      {[3, 6, 9, 15, 18, 21].map((hour) => {
        const p = point(hour * 60, 97);
        return (
          <text key={hour} x={p.x} y={p.y + 4} textAnchor="middle" className="dial-hour-label">
            {String(hour).padStart(2, '0')}
          </text>
        );
      })}
      {(
        [
          { hour: 0, kind: 'midnight', label: tr('DialFace.midnight') },
          { hour: 12, kind: 'noon', label: tr('DialFace.noon') },
        ] as const
      ).map(({ hour, kind, label }) => {
        const p = point(hour * 60, 92);
        return (
          <g
            key={kind}
            transform={`translate(${p.x} ${p.y - 5})`}
            className={`dial-day-symbol ${kind}`}
          >
            <DaySymbol kind={kind} />
            <text y={22} textAnchor="middle" className="dial-day-label">
              {label} · {String(hour).padStart(2, '0')}
            </text>
          </g>
        );
      })}
    </>
  );
}
