interface LoadingSkeletonProps {
  variant?: 'card' | 'list-row' | 'tile' | 'block';
  count?: number;
  className?: string;
}

const shimmer = 'animate-pulse';
const skelBg = { background: 'var(--surface-2)' } as const;

function CardSkeleton() {
  return (
    <div
      className={`card ${shimmer}`}
      style={{ padding: 14 }}
    >
      <div className="flex items-center gap-3">
        <div style={{ ...skelBg, width: 72, height: 72, borderRadius: 12 }} />
        <div className="flex-1 space-y-2">
          <div style={{ ...skelBg, height: 14, width: '60%', borderRadius: 6 }} />
          <div style={{ ...skelBg, height: 12, width: '40%', borderRadius: 6 }} />
        </div>
      </div>
    </div>
  );
}

function ListRowSkeleton() {
  return (
    <div className={`flex items-center gap-3 p-3 ${shimmer}`} style={{ background: 'var(--surface)', borderRadius: 14, border: '0.5px solid var(--hairline)' }}>
      <div style={{ ...skelBg, width: 40, height: 40, borderRadius: 999 }} />
      <div className="flex-1 space-y-2">
        <div style={{ ...skelBg, height: 12, width: '50%', borderRadius: 6 }} />
        <div style={{ ...skelBg, height: 10, width: '33%', borderRadius: 6 }} />
      </div>
    </div>
  );
}

function TileSkeleton() {
  return <div className={shimmer} style={{ ...skelBg, aspectRatio: '1 / 1', width: '100%', borderRadius: 14 }} />;
}

function BlockSkeleton() {
  return <div className={shimmer} style={{ ...skelBg, height: 120, width: '100%', borderRadius: 20 }} />;
}

export function LoadingSkeleton({ variant = 'card', count = 3, className = '' }: LoadingSkeletonProps) {
  const Skel =
    variant === 'list-row' ? ListRowSkeleton :
    variant === 'tile' ? TileSkeleton :
    variant === 'block' ? BlockSkeleton :
    CardSkeleton;
  return (
    <div className={`space-y-3 ${className}`} aria-busy="true" aria-live="polite">
      {Array.from({ length: count }, (_, i) => <Skel key={i} />)}
    </div>
  );
}
