import { Icon } from './Icon';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
      <div className="w-20 h-20 rounded-full bg-error-container flex items-center justify-center mb-5">
        <Icon name="error" size={40} className="text-error" />
      </div>
      <h3 className="font-heading text-headline-md text-on-surface mb-2">{title}</h3>
      <p className="text-body-md text-on-surface-variant max-w-xs mb-6">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="h-12 px-8 bg-primary text-on-primary font-heading text-body-lg font-bold rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all"
          style={{ boxShadow: '0 8px 15px -3px rgba(0, 64, 224, 0.15)' }}
        >
          <Icon name="refresh" size={20} />
          Try Again
        </button>
      )}
    </div>
  );
}
