import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-10">
      <div className="w-16 h-16 rounded-[20px] bg-[var(--coral-soft)] text-[var(--coral)] flex items-center justify-center mb-3.5 font-heading font-semibold text-[28px]">
        !
      </div>
      <div className="hd-2 mb-1.5">{title}</div>
      <div className="t-sm max-w-[320px]">{message}</div>
      {onRetry && (
        <Button variant="dark" className="mt-[18px]" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
