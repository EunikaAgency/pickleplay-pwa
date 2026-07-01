import type { ReactNode } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';

interface OwnerSectionProps {
  title: string;
  icon: string;
  description?: string;
  /** Optional control rendered at the right of the header (e.g. an invite link). */
  action?: ReactNode;
  children: ReactNode;
}

// A titled card used across the owner editor tabs — the mobile analog of the
// web console's SectionCard.
export function OwnerSection({ title, icon, description, action, children }: OwnerSectionProps) {
  return (
    <section className="card p-4">
      <div className="lg:flex flex-nowrap items-center gap-2.5 mb-3.5">
        <span className="w-8 h-8 rounded-[10px] bg-[var(--primary-tint)] text-[var(--primary)] flex items-center justify-center shrink-0">
          <Icon name={icon} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="hd-3">{title}</div>
          {description && <div className="t-sm">{description}</div>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}
