interface LoadingSkeletonProps {
  variant?: 'card' | 'list-row' | 'tile' | 'block';
  count?: number;
  className?: string;
}

function CardSkeleton() {
  return (
    <div
      className="rounded-[12px] bg-surface-container-lowest p-4 animate-pulse"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="h-5 w-24 rounded-full bg-surface-container-high" />
        <div className="h-4 w-16 rounded-full bg-surface-container-high" />
      </div>
      <div className="mt-3 h-5 w-3/4 rounded bg-surface-container-high" />
      <div className="mt-2 h-4 w-1/2 rounded bg-surface-container-high" />
      <div className="mt-4 flex items-center justify-between">
        <div className="flex -space-x-2">
          <div className="h-7 w-7 rounded-full border-2 border-white bg-surface-container-high" />
          <div className="h-7 w-7 rounded-full border-2 border-white bg-surface-container-high" />
          <div className="h-7 w-7 rounded-full border-2 border-white bg-surface-container-high" />
        </div>
        <div className="h-4 w-16 rounded-full bg-surface-container-high" />
      </div>
    </div>
  );
}

function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-[12px] bg-surface-container-lowest p-3 animate-pulse">
      <div className="h-10 w-10 rounded-full bg-surface-container-high shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 w-1/2 rounded bg-surface-container-high" />
        <div className="h-3 w-1/3 rounded bg-surface-container-high" />
      </div>
    </div>
  );
}

function TileSkeleton() {
  return <div className="aspect-square w-full rounded-[14px] bg-surface-container-high animate-pulse" />;
}

function BlockSkeleton() {
  return <div className="h-32 w-full rounded-[14px] bg-surface-container-high animate-pulse" />;
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
