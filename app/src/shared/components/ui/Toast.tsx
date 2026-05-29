import { Icon } from './Icon';

interface ToastProps {
  message: string;
  show: boolean;
}

export function Toast({ message, show }: ToastProps) {
  return (
    <div className={`toast ${show ? 'show' : ''}`}>
      <span className="check">
        <Icon name="check" size={16} />
      </span>
      {message}
    </div>
  );
}
