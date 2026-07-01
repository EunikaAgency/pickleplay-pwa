const btnBase: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 6px',
};

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
  return (
    <div className={`seg ${className}`} style={{ gap: 6 }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            className={active ? 'active' : ''}
            style={{
              ...btnBase,
              ...(active ? { background: 'var(--surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : {}),
            }}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
