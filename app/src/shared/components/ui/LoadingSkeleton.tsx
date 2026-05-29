interface LoadingSkeletonProps {
  variant?: 'card' | 'list-row' | 'tile' | 'block';
  count?: number;
  className?: string;
}

const shimmer = 'animate-pulse';
const skelBg = 'bg-[var(--surface-2)]';

function CardSkeleton() {
  return (
    <div className={`card p-3.5 ${shimmer}`}>
      <div className="flex items-center gap-3">
        <div className={`${skelBg} w-[72px] h-[72px] rounded-xl`} />
        <div className="flex-1 space-y-2">
          <div className={`${skelBg} h-3.5 w-[60%] rounded-md`} />
          <div className={`${skelBg} h-3 w-[40%] rounded-md`} />
        </div>
      </div>
    </div>
  );
}

function ListRowSkeleton() {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-[14px] bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] ${shimmer}`}>
      <div className={`${skelBg} w-10 h-10 rounded-full`} />
      <div className="flex-1 space-y-2">
        <div className={`${skelBg} h-3 w-1/2 rounded-md`} />
        <div className={`${skelBg} h-2.5 w-1/3 rounded-md`} />
      </div>
    </div>
  );
}

function TileSkeleton() {
  return <div className={`${shimmer} ${skelBg} aspect-square w-full rounded-[14px]`} />;
}

function BlockSkeleton() {
  return <div className={`${shimmer} ${skelBg} h-[120px] w-full rounded-[20px]`} />;
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
