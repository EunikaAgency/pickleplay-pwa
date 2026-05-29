interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Segmented<T extends string>({ options, value, onChange, className = '' }: SegmentedProps<T>) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const w = `calc((100% - 6px) / ${options.length})`;
  return (
    <div className={`seg ${className}`}>
      <div
        className="indicator"
        style={{ width: w, transform: `translateX(calc(${idx} * 100%))` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
