interface ProgressBarProps {
  value: number;
}

export function ProgressBar({ value }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-1 rounded-[2px] bg-[var(--surface-2)] overflow-hidden">
      <div
        className="h-full bg-[var(--lime)] rounded-[2px] transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
