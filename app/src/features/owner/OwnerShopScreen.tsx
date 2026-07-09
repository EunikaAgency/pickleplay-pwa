import { useCallback, useEffect, useState } from 'react';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { Toast } from '../../shared/components/ui/Toast';
import { Segmented } from '../../shared/components/ui/Segmented';
import { Chip } from '../../shared/components/ui/Chip';
import { KpiCard } from './components/KpiCard';
import { InventoryItemForm } from './components/InventoryItemForm';
import { InventoryItemDetail } from './components/InventoryItemDetail';
import { useOwnerDashboard } from './hooks/useOwnerDashboard';
import {
  listRentalInventory,
  getRentalInventoryStats,
  archiveRentalInventoryItem,
  exportRentalInventoryCsv,
  type ApiRentalInventoryItem,
  type RentalInventoryStats,
} from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

// ── Types ────────────────────────────────────────────────────────────────────

interface OwnerShopScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

type ViewMode = 'table' | 'grid';
type CategoryFilter = 'all' | 'paddle' | 'ball' | 'gear' | 'apparel' | 'other';

const CATEGORIES: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'paddle', label: 'Paddle' },
  { value: 'ball', label: 'Ball' },
  { value: 'gear', label: 'Gear' },
  { value: 'apparel', label: 'Apparel' },
  { value: 'other', label: 'Other' },
];

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

const CATEGORY_LABEL: Record<string, string> = {
  paddle: 'Paddle',
  ball: 'Ball',
  gear: 'Gear',
  apparel: 'Apparel',
  other: 'Other',
};

function formatCondition(c: string): string {
  return c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatStatus(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

// ── Peso formatter (mirrors bookingDisplay.money) ────────────────────────────

function peso(n: number): string {
  return `₱${Math.round(n).toLocaleString()}`;
}

// ── Stock bar ────────────────────────────────────────────────────────────────

function StockBar({ available, total }: { available: number; total: number }) {
  const pct = total > 0 ? Math.round((available / total) * 100) : 0;
  const color = pct <= 25 ? 'bg-[var(--coral)]' : pct <= 50 ? 'bg-[#f59e0b]' : 'bg-[#22c55e]';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold tabular-nums text-[var(--ink)] min-w-[2.5rem] text-right">{available}/{total}</span>
    </div>
  );
}

// ── Actions dropdown (simple inline buttons) ─────────────────────────────────

function RowActions({ onView, onEdit, onArchive }: { onView: () => void; onEdit: () => void; onArchive: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={onView} className="text-xs font-semibold text-[var(--blue)] hover:underline px-1 py-0.5">View</button>
      <button onClick={onEdit} className="text-xs font-semibold text-[var(--ink)] hover:underline px-1 py-0.5">Edit</button>
      <button onClick={onArchive} className="text-xs font-semibold text-[var(--coral)] hover:underline px-1 py-0.5">Archive</button>
    </div>
  );
}

// ── Mobile card ──────────────────────────────────────────────────────────────

function MobileCard({ item, onView, onEdit, onArchive }: { item: ApiRentalInventoryItem; onView: (i: ApiRentalInventoryItem) => void; onEdit: (i: ApiRentalInventoryItem) => void; onArchive: (i: ApiRentalInventoryItem) => void }) {
  return (
    <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[var(--surface-2)] flex items-center justify-center shrink-0 text-[var(--muted)] text-lg font-bold">
            {item.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm text-[var(--ink)] truncate">{item.name}</div>
            {item.brand && <div className="text-xs text-[var(--muted)]">{item.brand}</div>}
          </div>
        </div>
        <Chip ariaLabel={item.category} variant="default">{CATEGORY_LABEL[item.category] ?? item.category}</Chip>
      </div>
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-[var(--muted)]">SKU: {item.sku}</span>
        <span className="font-bold text-[var(--ink)]">{peso(item.rentalPricePerHour)}/hr</span>
      </div>
      <StockBar available={item.availableStock} total={item.totalStock} />
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${CONDITION_BADGE[item.condition] ?? 'bg-[var(--surface-2)] text-[var(--muted)]'}`}>{formatCondition(item.condition)}</span>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[item.status] ?? 'bg-[var(--surface-2)] text-[var(--muted)]'}`}>{formatStatus(item.status)}</span>
        {item.rentedCount > 0 && <span className="text-[11px] text-[var(--muted)]">{item.rentedCount} rented</span>}
      </div>
      <div className="flex items-center gap-2 pt-1 border-t border-[var(--hairline)]">
        <RowActions onView={() => onView(item)} onEdit={() => onEdit(item)} onArchive={() => onArchive(item)} />
      </div>
    </div>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export function OwnerShopScreen({ onNavigate: _onNavigate, onBack }: OwnerShopScreenProps) {
  const { venues } = useOwnerDashboard();

  // Data state
  const [items, setItems] = useState<ApiRentalInventoryItem[]>([]);
  const [stats, setStats] = useState<RentalInventoryStats | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [toast, setToast] = useState<string | null>(null);

  // Filters
  const [selectedVenueId, setSelectedVenueId] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ApiRentalInventoryItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<ApiRentalInventoryItem | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchData = useCallback(() => {
    let cancelled = false;
    setStatus('loading');
    const venueParam = selectedVenueId || undefined;
    Promise.all([
      getRentalInventoryStats({ venueId: venueParam }),
      listRentalInventory({ category: categoryFilter !== 'all' ? categoryFilter : undefined, search: search || undefined, venueId: venueParam }),
    ]).then(([s, list]) => {
      if (cancelled) return;
      setStats(s);
      setItems(list);
      setStatus('ready');
    }).catch(() => {
      if (!cancelled) setStatus('error');
    });
    return () => { cancelled = true; };
  }, [selectedVenueId, categoryFilter, search]);

  useEffect(() => {
    const cleanup = fetchData();
    return cleanup;
  }, [fetchData]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Actions ──────────────────────────────────────────────────────────────

  function handleAddItem() {
    setEditingItem(null);
    setFormOpen(true);
  }

  function handleEditItem(item: ApiRentalInventoryItem) {
    setEditingItem(item);
    setFormOpen(true);
  }

  function handleViewItem(item: ApiRentalInventoryItem) {
    setDetailItem(item);
    setDetailOpen(true);
  }

  async function handleArchiveItem(item: ApiRentalInventoryItem) {
    if (!window.confirm(`Archive "${item.name}"? It will be hidden from the active inventory.`)) return;
    try {
      await archiveRentalInventoryItem(item.id);
      setToast(`"${item.name}" archived`);
      fetchData();
    } catch {
      setToast('Failed to archive item');
    }
  }

  function handleFormSaved() {
    setFormOpen(false);
    setEditingItem(null);
    fetchData();
    setToast(editingItem ? 'Item updated' : 'Item added');
  }

  async function handleExportCsv() {
    try {
      const csv = await exportRentalInventoryCsv({
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        venueId: selectedVenueId || undefined,
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rental-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setToast('CSV exported');
    } catch {
      setToast('Export failed');
    }
  }

  // ── Filtered items ───────────────────────────────────────────────────────

  const showVenueDropdown = venues.length > 1;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="pb-v2">
      <ScreenHeader
        onBack={onBack}
        title="Rental Inventory"
        subtitle="Equipment stock and rental availability"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="h-9 px-3 rounded-full text-xs font-bold bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[var(--hairline)] transition-colors hidden sm:inline-flex items-center gap-1"
            >
              Export CSV
            </button>
            <button
              onClick={handleAddItem}
              className="h-9 px-4 rounded-full text-xs font-bold bg-[var(--lime)] text-[var(--on-accent)] hover:opacity-90 transition-opacity inline-flex items-center gap-1"
            >
              + Add Item
            </button>
          </div>
        }
      />

      <div className="px-5 space-y-4 pb-6">
        {/* ── Stats ──────────────────────────────────────────────────── */}
        {status === 'loading' && !stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <LoadingSkeleton key={i} variant="card" count={1} />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Total Stock Items" value={String(stats.totalStock)} icon="inventory_2" tone="primary" />
            <KpiCard label="Currently Rented" value={String(stats.rentedCount)} icon="trending_up" tone="coral" />
            <KpiCard label="Available Items" value={String(stats.availableStock)} icon="check_circle" tone="lime" />
            <KpiCard label="Low Stock Alerts" value={String(stats.lowStockCount)} icon="warning" tone="star" />
          </div>
        ) : null}

        {/* ── Filter bar ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          {/* Venue dropdown + Export (mobile) */}
          <div className="flex items-center gap-2">
            {showVenueDropdown && (
              <select
                value={selectedVenueId}
                onChange={(e) => setSelectedVenueId(e.target.value)}
                className="h-9 px-3 rounded-full text-xs font-semibold bg-[var(--surface)] border border-[var(--field-border)] text-[var(--ink)]"
              >
                <option value="">All Venues</option>
                {venues.map((v: any) => (
                  <option key={v.id ?? v._id} value={v.id ?? v._id?.toString()}>{v.displayName ?? v.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={handleExportCsv}
              className="h-9 px-3 rounded-full text-xs font-bold bg-[var(--surface-2)] text-[var(--ink)] sm:hidden inline-flex items-center gap-1"
            >
              Export CSV
            </button>
          </div>

          {/* Category pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((c) => (
              <Chip
                key={c.value}
                selected={categoryFilter === c.value}
                onClick={() => setCategoryFilter(c.value)}
                ariaLabel={c.label}
              >
                {c.label}
              </Chip>
            ))}
          </div>

          {/* Search + View toggle */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items, brand, SKU, or category..."
                className="w-full h-9 pl-9 pr-3 rounded-full text-xs bg-[var(--surface)] border border-[var(--field-border)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--lime)]"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            </div>
            <div className="hidden md:block">
              <Segmented
                options={[{ value: 'table', label: 'Table' }, { value: 'grid', label: 'Grid' }]}
                value={viewMode}
                onChange={(v) => setViewMode(v as ViewMode)}
              />
            </div>
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────────── */}
        {status === 'loading' ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <LoadingSkeleton key={i} variant="list-row" count={1} />)}
          </div>
        ) : status === 'error' ? (
          <ErrorState message="Could not load inventory" onRetry={fetchData} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="inventory_2"
            title="No rental inventory yet"
            description="Add your first rental item to start tracking equipment availability."
            action={{ label: 'Add Item', onPress: handleAddItem }}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className={viewMode === 'table' ? 'hidden md:block' : 'hidden'}>
              <div className="overflow-x-auto rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] shadow-sm">
                <table className="w-full min-w-[700px] border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--hairline)] text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] text-left">
                      <th className="py-3 px-4">Item</th>
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Price/hr</th>
                      <th className="py-3 px-4">Stock</th>
                      <th className="py-3 px-4">Available</th>
                      <th className="py-3 px-4">Rented</th>
                      <th className="py-3 px-4">Condition</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-t border-[var(--hairline)] hover:bg-[var(--surface-2)] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[var(--surface-2)] flex items-center justify-center shrink-0 text-[var(--muted)] text-xs font-bold">
                              {item.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-[var(--ink)] truncate max-w-[180px]">{item.name}</div>
                              {item.brand && <div className="text-[11px] text-[var(--muted)]">{item.brand}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[var(--muted)] text-xs font-mono">{item.sku}</td>
                        <td className="py-3 px-4">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--muted)]">
                            {CATEGORY_LABEL[item.category] ?? item.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-[var(--ink)]">{peso(item.rentalPricePerHour)}</td>
                        <td className="py-3 px-4 font-semibold tabular-nums text-[var(--ink)]">{item.totalStock}</td>
                        <td className="py-3 px-4">
                          <StockBar available={item.availableStock} total={item.totalStock} />
                        </td>
                        <td className="py-3 px-4 font-semibold tabular-nums text-[var(--ink)]">{item.rentedCount}</td>
                        <td className="py-3 px-4">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${CONDITION_BADGE[item.condition] ?? 'bg-[var(--surface-2)] text-[var(--muted)]'}`}>
                            {formatCondition(item.condition)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[item.status] ?? 'bg-[var(--surface-2)] text-[var(--muted)]'}`}>
                            {formatStatus(item.status)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <RowActions
                            onView={() => handleViewItem(item)}
                            onEdit={() => handleEditItem(item)}
                            onArchive={() => handleArchiveItem(item)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className={viewMode === 'grid' ? 'block md:hidden' : 'block md:hidden'}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {items.map((item) => (
                  <MobileCard
                    key={item.id}
                    item={item}
                    onView={handleViewItem}
                    onEdit={handleEditItem}
                    onArchive={handleArchiveItem}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────── */}
      {formOpen && (
        <InventoryItemForm
          item={editingItem}
          venues={venues as any[]}
          onSave={handleFormSaved}
          onCancel={() => { setFormOpen(false); setEditingItem(null); }}
        />
      )}

      {detailOpen && detailItem && (
        <InventoryItemDetail
          item={detailItem}
          onClose={() => { setDetailOpen(false); setDetailItem(null); }}
          onEdit={() => { setDetailOpen(false); handleEditItem(detailItem); }}
          onArchive={() => { setDetailOpen(false); handleArchiveItem(detailItem); }}
        />
      )}

      {/* ── Toast ─────────────────────────────────────────────────────── */}
      <Toast message={toast ?? ''} show={toast !== null} />
    </div>
  );
}
