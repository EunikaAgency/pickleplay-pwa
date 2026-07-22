import { Icon } from './Icon';

interface ToastProps {
  message: string;
  show: boolean;
  /** 'success' (green check, default) or 'error' (coral warning icon). */
  tone?: 'success' | 'error';
}

export function Toast({ message, show, tone = 'success' }: ToastProps) {
  const isError = tone === 'error';
  return (
    <div className={`toast${isError ? ' toast-error' : ''} ${show ? 'show' : ''}`}>
      <span className="check">
        <Icon name={isError ? 'error' : 'check'} size={16} />
      </span>
      {message}
    </div>
  );
}
