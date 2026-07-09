import { useState } from 'react';
import { BottomSheet } from '../../../shared/components/ui/BottomSheet';
import { FormField } from '../../../shared/components/forms/FormField';
import { FormSelect } from '../../../shared/components/forms/FormSelect';
import {
  createRentalInventoryItem,
  updateRentalInventoryItem,
  type ApiRentalInventoryItem,
} from '../../../shared/lib/api';

// ── Option constants ──────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: 'paddle', label: 'Paddle' },
  { value: 'ball', label: 'Ball' },
  { value: 'gear', label: 'Gear' },
  { value: 'apparel', label: 'Apparel' },
  { value: 'other', label: 'Other' },
];

const CONDITION_OPTIONS = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'needs_repair', label: 'Needs Repair' },
  { value: 'retired', label: 'Retired' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Auto (based on stock)' },
  { value: 'available', label: 'Available' },
  { value: 'partially_rented', label: 'Partially Rented' },
  { value: 'fully_rented', label: 'Fully Rented' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
];

// ── Types ────────────────────────────────────────────────────────────────────

interface InventoryItemFormProps {
  item: ApiRentalInventoryItem | null;
  venues: Array<{ id?: string; _id?: string; displayName?: string; name?: string }>;
  onSave: () => void;
  onCancel: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function InventoryItemForm({ item, venues, onSave, onCancel }: InventoryItemFormProps) {
  const isEdit = item !== null;

  const [name, setName] = useState(item?.name ?? '');
  const [brand, setBrand] = useState(item?.brand ?? '');
  const [sku, setSku] = useState(item?.sku ?? '');
  const [category, setCategory] = useState(item?.category ?? 'paddle');
  const [description, setDescription] = useState(item?.description ?? '');
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? '');
  const [rentalPricePerHour, setRentalPricePerHour] = useState(String(item?.rentalPricePerHour ?? ''));
  const [totalStock, setTotalStock] = useState(String(item?.totalStock ?? ''));
  const [availableStock, setAvailableStock] = useState(String(item?.availableStock ?? ''));
  const [rentedCount, setRentedCount] = useState(String(item?.rentedCount ?? ''));
  const [lowStockThreshold, setLowStockThreshold] = useState(String(item?.lowStockThreshold ?? '3'));
  const [condition, setCondition] = useState(item?.condition ?? 'good');
  const [status, setStatus] = useState(item?.status ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [venueId, setVenueId] = useState(item?.venueId ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation
  const nameErr = !name.trim() ? 'Required' : '';
  const skuErr = !sku.trim() ? 'Required' : '';
  const categoryErr = !category ? 'Required' : '';
  const priceErr = rentalPricePerHour !== '' && Number(rentalPricePerHour) < 0 ? 'Must be 0 or higher' : '';
  const totalErr = totalStock !== '' && Number(totalStock) < 0 ? 'Must be 0 or higher' : '';
  const availErr = availableStock !== '' && Number(availableStock) < 0 ? 'Must be 0 or higher' : '';
  const rentedErr = rentedCount !== '' && Number(rentedCount) < 0 ? 'Must be 0 or higher' : '';
  const lowErr = lowStockThreshold !== '' && Number(lowStockThreshold) < 0 ? 'Must be 0 or higher' : '';
  const stockInvariantErr = (availableStock !== '' && rentedCount !== '' && totalStock !== '' && Number(availableStock) + Number(rentedCount) > Number(totalStock))
    ? 'Available + Rented cannot exceed Total Stock' : '';

  const canSave = !nameErr && !skuErr && !categoryErr && !priceErr && !totalErr && !availErr && !rentedErr && !lowErr && !stockInvariantErr && !saving;

  async function handleSubmit() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        brand: brand.trim(),
        sku: sku.trim(),
        category,
        description,
        imageUrl,
        rentalPricePerHour: Number(rentalPricePerHour) || 0,
        totalStock: Number(totalStock) || 0,
        availableStock: Number(availableStock) || 0,
        rentedCount: Number(rentedCount) || 0,
        lowStockThreshold: Number(lowStockThreshold) || 0,
        condition,
        notes,
        venueId: venueId || null,
      };
      if (status) payload.status = status;

      if (isEdit) {
        await updateRentalInventoryItem(item!.id, payload);
      } else {
        await createRentalInventoryItem(payload);
      }
      onSave();
    } catch (e: any) {
      setError(e?.error?.message ?? e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      open
      onClose={onCancel}
      title={isEdit ? 'Edit Item' : 'Add Item'}
      subtitle={isEdit ? `Editing "${item!.name}"` : 'Add a new rental inventory item'}
      footer={
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 h-11 rounded-xl bg-[var(--surface-2)] text-[var(--ink)] font-bold text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={!canSave} className="flex-1 h-11 rounded-xl bg-[var(--lime)] text-[var(--on-accent)] font-bold text-sm disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      }
    >
      <div className="space-y-3 px-1">
        {error && <div className="text-xs font-semibold text-[var(--coral)] bg-[var(--coral-soft)] px-3 py-2 rounded-lg">{error}</div>}

        <FormField label="Item Name" value={name} onChange={(e: any) => setName(e.target.value)} error={nameErr} required />
        <FormField label="Brand" value={brand} onChange={(e: any) => setBrand(e.target.value)} />
        <FormField label="SKU" value={sku} onChange={(e: any) => setSku(e.target.value)} error={skuErr} required />

        <FormSelect label="Category" value={category} onChange={(v) => setCategory(String(v) as typeof category)} options={CATEGORY_OPTIONS} />

        <FormField label="Description" value={description} onChange={(e: any) => setDescription(e.target.value)} />

        <FormField label="Image URL" value={imageUrl} onChange={(e: any) => setImageUrl(e.target.value)} placeholder="https://…" />

        <FormField label="Rental Price per Hour (₱)" value={rentalPricePerHour} onChange={(e: any) => setRentalPricePerHour(e.target.value)} error={priceErr} type="number" min="0" />

        <div className="grid grid-cols-3 gap-2">
          <FormField label="Total Stock" value={totalStock} onChange={(e: any) => setTotalStock(e.target.value)} error={totalErr} type="number" min="0" />
          <FormField label="Available" value={availableStock} onChange={(e: any) => setAvailableStock(e.target.value)} error={availErr} type="number" min="0" />
          <FormField label="Rented" value={rentedCount} onChange={(e: any) => setRentedCount(e.target.value)} error={rentedErr} type="number" min="0" />
        </div>
        {stockInvariantErr && <div className="text-xs font-semibold text-[var(--coral)]">{stockInvariantErr}</div>}

        <FormField label="Low Stock Threshold" value={lowStockThreshold} onChange={(e: any) => setLowStockThreshold(e.target.value)} error={lowErr} type="number" min="0" />

        <FormSelect label="Condition" value={condition} onChange={(v) => setCondition(String(v) as typeof condition)} options={CONDITION_OPTIONS} />

        <FormSelect label="Status" value={status} onChange={(v) => setStatus(String(v) as typeof status)} options={STATUS_OPTIONS} />

        {/* Venue selector */}
        {venues.length > 0 && (
          <FormSelect
            label="Venue"
            value={venueId}
            onChange={(v) => setVenueId(String(v) as typeof venueId)}
            options={[
              { value: '', label: 'All Venues (shared equipment)' },
              ...venues.map((v: any) => ({ value: String(v.id ?? v._id ?? ''), label: v.displayName ?? v.name ?? '' })),
            ]}
          />
        )}

        <FormField label="Notes" value={notes} onChange={(e: any) => setNotes(e.target.value)} />
      </div>
    </BottomSheet>
  );
}
