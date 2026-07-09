import { BottomSheet } from '../../../shared/components/ui/BottomSheet';
import type { ApiRentalInventoryItem } from '../../../shared/lib/api';

interface InventoryItemDetailProps {
  item: ApiRentalInventoryItem;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
}

function peso(n: number): string {
  return `₱${Math.round(n).toLocaleString()}`;
}

function formatLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

const CONDITION_BADGE: Record<string, string> = {
  excellent: 'bg-[#E8F5E9] text-[#2E7D32]',
  good: 'bg-[#E3F2FD] text-[#1565C0]',
  fair: 'bg-[#FFF3E0] text-[#E65100]',
  needs_repair: 'bg-[#FFEBEE] text-[#C62828]',
  retired: 'bg-[#F5F5F5] text-[#9E9E9E]',
};

const STATUS_BADGE: Record<string, string> = {
  available: 'bg-[#E8F5E9] text-[#2E7D32]',
  partially_rented: 'bg-[#FFF3E0] text-[#E65100]',
  fully_rented: 'bg-[#FFEBEE] text-[#C62828]',
  maintenance: 'bg-[#E3F2FD] text-[#1565C0]',
  retired: 'bg-[#F5F5F5] text-[#9E9E9E]',
};

export function InventoryItemDetail({ item, onClose, onEdit, onArchive }: InventoryItemDetailProps) {
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={item.name}
      subtitle={item.brand ?? 'Rental Item'}
      footer={
        <div className="flex gap-2">
          <button onClick={onArchive} className="flex-1 h-11 rounded-xl bg-[var(--coral-soft)] text-[var(--coral)] font-bold text-sm">Archive</button>
          <button onClick={onEdit} className="flex-1 h-11 rounded-xl bg-[var(--lime)] text-[var(--on-accent)] font-bold text-sm">Edit Item</button>
        </div>
      }
    >
      <div className="space-y-4 px-1">
        {/* Image placeholder */}
        <div className="w-full h-32 rounded-xl bg-[var(--surface-2)] flex items-center justify-center text-[var(--muted)] text-4xl font-bold">
          {item.name.charAt(0)}
        </div>

        {/* Key details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">SKU</div><div className="font-semibold text-[var(--ink)]">{item.sku}</div></div>
          <div><div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Category</div><div className="font-semibold text-[var(--ink)]">{formatLabel(item.category)}</div></div>
          <div><div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Rental Price</div><div className="font-semibold text-[var(--ink)]">{peso(item.rentalPricePerHour)}/hr</div></div>
          <div><div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Low Stock Alert</div><div className="font-semibold text-[var(--ink)]">≤ {item.lowStockThreshold}</div></div>
        </div>

        {/* Stock breakdown */}
        <div className="rounded-xl border border-[var(--hairline)] p-4 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Stock Breakdown</div>
          <div className="flex gap-3">
            <div className="flex-1 text-center py-2 rounded-lg bg-[var(--surface-2)]"><div className="text-lg font-bold text-[var(--ink)]">{item.totalStock}</div><div className="text-[10px] text-[var(--muted)]">Total</div></div>
            <div className="flex-1 text-center py-2 rounded-lg bg-[#E8F5E9]"><div className="text-lg font-bold text-[#2E7D32]">{item.availableStock}</div><div className="text-[10px] text-[#2E7D32]">Available</div></div>
            <div className="flex-1 text-center py-2 rounded-lg bg-[#FFF3E0]"><div className="text-lg font-bold text-[#E65100]">{item.rentedCount}</div><div className="text-[10px] text-[#E65100]">Rented</div></div>
          </div>
        </div>

        {/* Condition + Status */}
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${CONDITION_BADGE[item.condition] ?? ''}`}>{formatLabel(item.condition)}</span>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_BADGE[item.status] ?? ''}`}>{formatLabel(item.status)}</span>
        </div>

        {/* Description */}
        {item.description && (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1">Description</div>
            <div className="text-sm text-[var(--ink)]">{item.description}</div>
          </div>
        )}

        {/* Notes */}
        {item.notes && (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1">Notes</div>
            <div className="text-sm text-[var(--muted)]">{item.notes}</div>
          </div>
        )}

        {/* Dates */}
        <div className="text-[11px] text-[var(--muted)] space-y-0.5 border-t border-[var(--hairline)] pt-3">
          <div>Created: {new Date(item.createdAt).toLocaleDateString()}</div>
          <div>Updated: {new Date(item.updatedAt).toLocaleDateString()}</div>
        </div>
      </div>
    </BottomSheet>
  );
}
