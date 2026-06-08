import { useState, type ReactNode } from 'react';
import { Icon } from './Icon';

type ThumbVariant = 'lime' | 'blue' | 'coral';

interface GameRowProps {
  day: string;
  num: string;
  thumb?: ThumbVariant;
  title: string;
  time: string;
  loc: string;
  joined?: boolean;
  showRsvp?: boolean;
  onTap?: () => void;
  onRsvp?: (joined: boolean) => void;
  /** Optional actions rendered inside the card, below the row (e.g. host Edit/Delete). */
  footer?: ReactNode;
}

export function GameRow({ day, num, thumb = 'lime', title, time, loc, joined = false, showRsvp = true, onTap, onRsvp, footer }: GameRowProps) {
  const [j, setJ] = useState(joined);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !j;
    setJ(next);
    onRsvp?.(next);
  };
  return (
    <div className={`game-row ${footer ? 'has-footer' : ''}`}>
      <div className={`game-row-main ${onTap ? 'cursor-pointer' : ''}`} role={onTap ? 'button' : undefined} tabIndex={onTap ? 0 : undefined} onClick={onTap}
        onKeyDown={(e) => { if (onTap && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onTap(); } }}
      >
        <div className={`thumb ${thumb}`}>
          <span className="day">{day}</span>
          <span className="num">{num}</span>
        </div>
        <div className="body">
          <div className="title">{title}</div>
          <div className="meta">
            <span className="m"><Icon name="clock" size={11} />{time}</span>
            <span className="m"><Icon name="location" size={11} />{loc}</span>
          </div>
        </div>
        {showRsvp && (
          <button className={`rsvp ${j ? 'joined' : ''}`} onClick={toggle} aria-label={j ? 'Leave' : 'Join'}>
            <Icon name={j ? 'check' : 'plus'} size={18} />
          </button>
        )}
      </div>
      {/* Footer lives inside the card; stop taps here from triggering the row's onTap. */}
      {footer && <div className="game-row-footer" onClick={(e) => e.stopPropagation()}>{footer}</div>}
    </div>
  );
}
