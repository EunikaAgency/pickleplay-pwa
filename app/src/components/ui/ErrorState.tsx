interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-10">
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: 'var(--coral-soft)',
          color: 'var(--coral)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
          fontFamily: 'var(--font-heading)',
          fontWeight: 600,
          fontSize: 28,
        }}
      >
        !
      </div>
      <div className="hd-2" style={{ marginBottom: 6 }}>{title}</div>
      <div className="t-sm" style={{ maxWidth: 320 }}>{message}</div>
      {onRetry && (
        <button className="btn-primary dark" style={{ marginTop: 18, width: 'auto', padding: '0 24px' }} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
