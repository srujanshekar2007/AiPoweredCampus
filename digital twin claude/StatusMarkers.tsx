'use client';

import { Html } from '@react-three/drei';
import type { StatusSummary, Vec3 } from '@/types/digital-twin';

interface StatusMarkersProps {
  /** Position in the parent group's local space. */
  position: Vec3;
  /** Result of summarizeIssues() for whatever this marker sits above. */
  summary: StatusSummary;
  /** Optional short text shown beside the dot (e.g. "F2"). */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  /** When provided the marker becomes a clickable button. */
  onClick?: () => void;
}

const SIZE_CLASSES = {
  sm: 'h-5 w-5 text-[10px]',
  md: 'h-7 w-7 text-xs',
  lg: 'h-9 w-9 text-sm',
} as const;

/**
 * Floating status marker.
 *   red   -> at least one pending / in_progress issue (pulses, shows open count)
 *   green -> issues exist and all are resolved (check icon)
 *   none  -> nothing rendered
 */
export function StatusMarkers({ position, summary, label, size = 'md', onClick }: StatusMarkersProps) {
  if (summary.marker === 'none') return null;

  const isRed = summary.marker === 'red';
  const description = isRed
    ? `${summary.openIssues} unresolved issue${summary.openIssues === 1 ? '' : 's'}`
    : 'All issues resolved';

  const body = (
    <span className="relative flex items-center gap-1.5">
      <span className={`relative flex items-center justify-center ${SIZE_CLASSES[size]}`}>
        {isRed && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
        )}
        <span
          className={`relative inline-flex h-full w-full items-center justify-center rounded-full border-2 border-white font-bold text-white shadow-lg ${
            isRed ? 'bg-red-500' : 'bg-emerald-500'
          }`}
        >
          {isRed ? (
            summary.openIssues
          ) : (
            <svg viewBox="0 0 20 20" className="h-3/5 w-3/5" fill="none" stroke="currentColor" strokeWidth={3}>
              <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </span>
      {label && (
        <span className="rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-medium text-white shadow">
          {label}
        </span>
      )}
    </span>
  );

  return (
    <Html
      position={position}
      center
      zIndexRange={[30, 0]}
      distanceFactor={size === 'lg' ? 14 : 11}
      pointerEvents={onClick ? 'auto' : 'none'}
      style={{ userSelect: 'none' }}
    >
      {onClick ? (
        <button
          type="button"
          aria-label={description}
          title={description}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="cursor-pointer transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          {body}
        </button>
      ) : (
        <div role="img" aria-label={description} title={description}>
          {body}
        </div>
      )}
    </Html>
  );
}
