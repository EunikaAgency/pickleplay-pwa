import { Icon } from './Icon';

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
        <Icon name="sync" size={32} className="text-primary animate-spin" />
      </div>
      <p className="text-body-md text-on-surface-variant">{message}</p>
    </div>
  );
}
