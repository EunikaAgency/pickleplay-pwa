import type { ReactNode } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';

interface OrganizerSectionProps {
  title: string;
  icon: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

// Titled card used across the organizer console screens — the organizer analog
// of owner/components/OwnerSection.
export function OrganizerSection({ title, icon, description, action, children }: OrganizerSectionProps) {
  return (
    <section className="card p-4">
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="w-8 h-8 rounded-[10px] bg-[var(--primary-tint)] text-[var(--primary)] flex items-center justify-center shrink-0">
          <Icon name={icon} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="hd-3">{title}</div>
          {description && <div className="t-sm">{description}</div>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
