import { useNotificationStore } from '../../lib/notificationStore';

interface NotificationBadgeProps {
  /** Extra positioning classes (the parent must be `relative`). */
  className?: string;
}

/** Live unread-notification count bubble. Renders nothing when there's nothing
 *  unread. Reads the shared notification store directly, so just drop it inside
 *  a `relative` container (a bell button, a tab). */
export function NotificationBadge({ className = '' }: NotificationBadgeProps) {
  const unread = useNotificationStore((s) => s.unread);
  if (unread <= 0) return null;
  return (
    <span
      className={`absolute min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--coral)] text-white text-[10px] font-extrabold leading-[18px] text-center ring-2 ring-[var(--bg)] ${className}`}
      aria-label={`${unread} unread notifications`}
    >
      {unread > 9 ? '9+' : unread}
    </span>
  );
}
