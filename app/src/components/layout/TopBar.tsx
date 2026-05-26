import { Icon } from '../ui/Icon';

interface TopBarProps {
  showBack?: boolean;
  onBack?: () => void;
}

export function TopBar({ showBack = false, onBack }: TopBarProps) {
  return (
    <header className="sticky top-0 z-50 w-full bg-white py-1">
      <div className="mx-auto flex h-12 w-full max-w-7xl items-center justify-between px-5">
        <div className="flex items-center gap-2 min-w-0">
          {showBack && (
            <button onClick={onBack} className="active:scale-95 transition-transform -ml-1 p-1" aria-label="Back">
              <Icon name="arrow_back" size={24} className="text-primary" />
            </button>
          )}
          <span className="font-heading text-headline-md font-bold text-primary truncate">
            PicklePlay
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Icon name="notifications" size={22} className="text-on-surface-variant hover:opacity-80 transition-opacity active:scale-95" />
          <Icon name="chat" size={22} className="text-on-surface-variant hover:opacity-80 transition-opacity active:scale-95" />
        </div>
      </div>
    </header>
  );
}
