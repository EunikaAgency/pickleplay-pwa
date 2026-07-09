# Plan: Owner-only Rental Inventory / Shop Module

## Context

Add a **Rental Inventory management module** for venue owners in the PickleBallers PWA + API. Rental-only for now (ecommerce not yet approved), but structure the UI, naming, and data model so ecommerce can be added later.

- **Nav label**: "Shop" (future-proof for eventual ecommerce)
- **Page title**: "Rental Inventory"
- **Subtitle**: "Equipment stock and rental availability"
- **Route**: `/shop`
- **Role**: Owner only (and staff who inherit owner permissions via `effectiveOwnerId`). Players, coaches, organizers: no access, redirected.

## Files to create

### API (`api/`)

| File | Purpose |
|---|---|
| `src/features/rental-inventory/rental-inventory.model.ts` | Mongoose schema + model export |
| `src/features/rental-inventory/rental-inventory.controller.ts` | 7 handlers: CRUD + stats + CSV export |
| `src/features/rental-inventory/rental-inventory.routes.ts` | Hono router with `requireAuth` + inline permission checks |

### App (`app/`)

| File | Purpose |
|---|---|
| `src/features/owner/OwnerShopScreen.tsx` | Main page — header, stats, filters, table/card list |
| `src/features/owner/components/InventoryItemForm.tsx` | Add/Edit form as a `BottomSheet` |
| `src/features/owner/components/InventoryItemDetail.tsx` | View detail as a `BottomSheet` |

Sub-components (stats cards, filters bar, table rows, cards) will be inlined in `OwnerShopScreen.tsx` to keep it manageable — following the `OwnerBookingsScreen` pattern where table rows are inline. If it grows too large, extract them, but start with a single screen file.

## Files to modify

### API

| File | Change |
|---|---|
| `src/shared/lib/permissions.ts` | Add 5 `owner.inventory.*` permissions to `ALL_PERMISSIONS`, `ROLE_PERMISSIONS.owner`, `ROLE_PERMISSIONS.staff`, `PERMISSION_CATALOGUE` |
| `src/routes/index.ts` | Import + `v1.route('/rental-inventory', rentalInventoryRoutes)` |
| `src/features/root/root.controller.ts` | Add 7 endpoint entries to `listEndpoints()` |
| `src/shared/db/seed-dummy-data.ts` | Add `ensure(RentalInventoryItem, ...)` with 6 sample items |
| `FILEMAP.md` | Add rental-inventory feature slice |

### App

| File | Change |
|---|---|
| `src/shared/lib/permissions.ts` | Mirror the 5 `owner.inventory.*` permissions (same additions as API) |
| `src/shared/lib/navigation.ts` | Add `owner-shop` to `Screen` union, `pathFromScreen`, `screenFromLocation`, `deepLinkParent` |
| `src/shared/lib/api.ts` | Add `ApiRentalInventoryItem` type + 7 client functions |
| `src/App.tsx` | Import screen, add to `SCREEN_PERMISSIONS`, `SCREEN_AUTH_INTENT`, `tabForScreen`, `renderScreen`, wire sidebar props |
| `src/shared/components/layout/Sidebar.tsx` | Add `onOpenShop`/`shopActive` props + "Shop" item for owner |
| `src/features/owner/OwnerProfileScreen.tsx` | Add "Shop" row in Manage section (mobile entry point) |
| `FILEMAP.md` | Add new files |

## Implementation steps

### Step 1: API — Permissions

In `api/src/shared/lib/permissions.ts`, add 5 permissions:

```ts
'owner.inventory.view',
'owner.inventory.create',
'owner.inventory.update',
'owner.inventory.archive',
'owner.inventory.export',
```

Add to:
- `ALL_PERMISSIONS` array (after `owner.games.view`)
- `ROLE_PERMISSIONS.owner` array
- `ROLE_PERMISSIONS.staff` array (staff inherit all operational owner perms)
- `PERMISSION_CATALOGUE` array (5 entries in "Owner" group)

### Step 2: API — Model

Create `api/src/features/rental-inventory/rental-inventory.model.ts`:

```ts
import { Schema, model } from 'mongoose';

const rentalInventoryItemSchema = new Schema({
  venueId: { type: Schema.Types.ObjectId, ref: 'Venue', default: null },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, maxlength: 200 },
  brand: { type: String, default: '' },
  sku: { type: String, required: true },
  category: { type: String, enum: ['paddle','ball','gear','apparel','other'], required: true },
  description: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  rentalPricePerHour: { type: Number, required: true, min: 0, default: 0 },
  totalStock: { type: Number, required: true, min: 0, default: 0 },
  availableStock: { type: Number, required: true, min: 0, default: 0 },
  rentedCount: { type: Number, required: true, min: 0, default: 0 },
  lowStockThreshold: { type: Number, default: 3, min: 0 },
  condition: { type: String, enum: ['excellent','good','fair','needs_repair','retired'], default: 'good' },
  status: { type: String, enum: ['available','partially_rented','fully_rented','maintenance','retired'], default: 'available' },
  notes: { type: String, default: '' },
  isArchived: { type: Boolean, default: false },
  // Future ecommerce (not surfaced in UI yet):
  salePrice: { type: Number, default: null },
  isForSale: { type: Boolean, default: false },
  ecommerceEnabled: { type: Boolean, default: false },
}, { timestamps: true });

// Compound unique: SKU per owner (different owners can have same SKU)
rentalInventoryItemSchema.index({ ownerId: 1, sku: 1 }, { unique: true });
rentalInventoryItemSchema.index({ ownerId: 1, isArchived: 1 });
rentalInventoryItemSchema.index({ name: 'text', brand: 'text', sku: 'text' });

export const RentalInventoryItem = model('RentalInventoryItem', rentalInventoryItemSchema);
```

### Step 3: API — Controller

Create `api/src/features/rental-inventory/rental-inventory.controller.ts`.

**Permission pattern**: Use inline `hasPermission(user, perm)` checks (matching the `partners.controller.ts` pattern), not a middleware factory. Scope all queries by `effectiveOwnerId(user)` so staff sub-accounts automatically access their owner's inventory.

**Auto-status helper**:
```ts
function computeStatus(item: { status: string; availableStock: number; totalStock: number; rentedCount: number }): string {
  if (item.status === 'retired') return 'retired';
  if (item.status === 'maintenance') return 'maintenance';
  if (item.availableStock === item.totalStock) return 'available';
  if (item.availableStock > 0 && item.rentedCount > 0) return 'partially_rented';
  if (item.availableStock === 0 && item.rentedCount > 0) return 'fully_rented';
  return 'available';
}
```

**Handlers:**

1. `listInventory` — `GET /` — parse Zod query schema (`category?`, `status?`, `search?`, `archived?`, `venueId?`), build filter scoped to `effectiveOwnerId(user)`. When `venueId` is provided, filter to that venue OR items with `venueId: null` (owner-wide items show in all venue views). Supports text search across name/brand/SKU.

2. `getInventoryItem` — `GET /:id` — find by id scoped to owner, 404 if not found.

3. `createInventoryItem` — `POST /` — Zod body validation, set `ownerId = effectiveOwnerId(user)`, auto-compute `status`, handle duplicate SKU (409). Accepts optional `venueId` — if provided, item is venue-scoped; if omitted, item is owner-wide.

4. `updateInventoryItem` — `PATCH /:id` — find scoped to owner, partial update with Zod, auto-compute status (unless manually set to maintenance/retired). Validate stock invariants. Supports changing `venueId` (including setting to `null` for owner-wide).

5. `archiveInventoryItem` — `DELETE /:id` — soft-delete: set `isArchived: true`. Don't actually delete.

6. `getInventoryStats` — `GET /stats` — accepts optional `venueId` query param. Aggregate counts scoped to owner + venue filter: totalStock sum, rentedCount sum, availableStock sum, lowStockCount (where availableStock <= lowStockThreshold AND status != 'retired' AND !isArchived). When `venueId` is provided, stats include that venue's items + owner-wide items (venueId: null).

7. `exportInventoryCsv` — `GET /export/csv` — accepts same filters as list. Query items scoped to owner + filters, build CSV string, return as `text/csv` with `Content-Disposition: attachment`.

### Step 4: API — Routes

Create `api/src/features/rental-inventory/rental-inventory.routes.ts`:

```ts
import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import { listInventory, getInventoryItem, createInventoryItem, updateInventoryItem, archiveInventoryItem, getInventoryStats, exportInventoryCsv } from './rental-inventory.controller.js';

const r = new Hono();
r.use(requireAuth); // All routes require auth; permission checked inline

r.get('/',              listInventory);
r.get('/stats',         getInventoryStats);
r.get('/export/csv',    exportInventoryCsv);
r.post('/',             createInventoryItem);
r.get('/:id',           getInventoryItem);
r.patch('/:id',         updateInventoryItem);
r.delete('/:id',        archiveInventoryItem);

export default r;
```

Mount in `routes/index.ts`:
```ts
import rentalInventoryRoutes from '../features/rental-inventory/rental-inventory.routes.js';
v1.route('/rental-inventory', rentalInventoryRoutes);
```

### Step 5: API — `/lists` update

Add 7 entries to `listEndpoints()` in `root.controller.ts` — one per endpoint with path, methods, description.

### Step 6: API — Seed data

In `seed-dummy-data.ts`, after venues are seeded, add:

```ts
const { RentalInventoryItem } = await import('../features/rental-inventory/rental-inventory.model.js');

const inventoryItems = await ensure(RentalInventoryItem, 'rental inventory', () => {
  const ownerId = ownerUser._id; // the seeded owner user
  return [
    { ownerId, name: 'Selkirk Amped S2', brand: 'Selkirk', sku: 'PAD-SEL-001', category: 'paddle', rentalPricePerHour: 150, totalStock: 12, availableStock: 7, rentedCount: 5, lowStockThreshold: 3, condition: 'excellent', status: 'partially_rented' },
    { ownerId, name: 'Engage Encore Pro', brand: 'Engage', sku: 'PAD-ENG-002', category: 'paddle', rentalPricePerHour: 180, totalStock: 8, availableStock: 3, rentedCount: 5, lowStockThreshold: 3, condition: 'excellent', status: 'partially_rented' },
    { ownerId, name: 'Franklin X-40 Outdoor', brand: 'Franklin', sku: 'BAL-FRA-003', category: 'ball', rentalPricePerHour: 30, totalStock: 60, availableStock: 38, rentedCount: 22, lowStockThreshold: 10, condition: 'good', status: 'partially_rented' },
    { ownerId, name: 'Dura Fast 40', brand: 'Dura', sku: 'BAL-DUR-004', category: 'ball', rentalPricePerHour: 30, totalStock: 45, availableStock: 30, rentedCount: 15, lowStockThreshold: 10, condition: 'good', status: 'partially_rented' },
    { ownerId, name: 'Pickle Bag Pro', brand: 'VenueOS', sku: 'GEA-VEN-005', category: 'gear', rentalPricePerHour: 80, totalStock: 20, availableStock: 14, rentedCount: 6, lowStockThreshold: 5, condition: 'excellent', status: 'partially_rented' },
    { ownerId, name: 'Court Shoes — Court King', brand: 'K-Swiss', sku: 'GEA-KSW-006', category: 'gear', rentalPricePerHour: 120, totalStock: 16, availableStock: 9, rentedCount: 7, lowStockThreshold: 5, condition: 'good', status: 'partially_rented' },
  ];
});
```

### Step 7: App — Permissions

Mirror the 5 `owner.inventory.*` permissions in `app/src/shared/lib/permissions.ts`:
- Add to `ALL_PERMISSIONS`
- Add to `ROLE_PERMISSIONS.owner` and `ROLE_PERMISSIONS.staff`
- No `PERMISSION_CATALOGUE` in the app copy (that's API-only)

### Step 8: App — API client

Add to `app/src/shared/lib/api.ts`:

**Types:**
```ts
export interface ApiRentalInventoryItem {
  id: string;
  venueId?: string;
  ownerId: string;
  name: string;
  brand?: string;
  sku: string;
  category: 'paddle' | 'ball' | 'gear' | 'apparel' | 'other';
  description?: string;
  imageUrl?: string;
  rentalPricePerHour: number;
  totalStock: number;
  availableStock: number;
  rentedCount: number;
  lowStockThreshold: number;
  condition: 'excellent' | 'good' | 'fair' | 'needs_repair' | 'retired';
  status: 'available' | 'partially_rented' | 'fully_rented' | 'maintenance' | 'retired';
  notes?: string;
  isArchived: boolean;
  salePrice?: number;
  isForSale?: boolean;
  ecommerceEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RentalInventoryStats {
  totalStock: number;
  rentedCount: number;
  availableStock: number;
  lowStockCount: number;
}

export interface RentalInventoryFilters {
  category?: string;
  status?: string;
  search?: string;
  archived?: boolean;
  venueId?: string;
}
```

**Functions** (following the existing `request<T>` / `rawRequest` pattern):
```ts
export function listRentalInventory(filters?: RentalInventoryFilters): Promise<ApiRentalInventoryItem[]> { ... }
export function getRentalInventoryItem(id: string): Promise<ApiRentalInventoryItem> { ... }
export function createRentalInventoryItem(data: Partial<ApiRentalInventoryItem>): Promise<ApiRentalInventoryItem> { ... }
export function updateRentalInventoryItem(id: string, data: Partial<ApiRentalInventoryItem>): Promise<ApiRentalInventoryItem> { ... }
export function archiveRentalInventoryItem(id: string): Promise<void> { ... }
export function getRentalInventoryStats(filters?: { venueId?: string }): Promise<RentalInventoryStats> { ... }
export function exportRentalInventoryCsv(filters?: RentalInventoryFilters): Promise<string> { ... }
```

### Step 9: App — Navigation

In `navigation.ts`:

**Add to `Screen` union** (alphabetically near other owner screens):
```ts
| { id: 'owner-shop' }
```

**Add to `pathFromScreen`:**
```ts
case 'owner-shop': return '/shop';
```

**Add to `screenFromLocation`** (as a top-level case, since `/shop` doesn't follow the `/owner/*` pattern):
```ts
case 'shop': return { id: 'owner-shop' };
```

**Add to `deepLinkParent`:**
```ts
if (id === 'owner-shop') return { id: 'profile' };
```

### Step 10: App — App.tsx

1. **Import**: `import { OwnerShopScreen } from './features/owner/OwnerShopScreen';`

2. **Add to `SCREEN_PERMISSIONS`**:
   ```ts
   'owner-shop': 'owner.access',
   ```

3. **Add to `SCREEN_AUTH_INTENT`**:
   ```ts
   'owner-shop': 'manage rental inventory',
   ```

4. **Add to `tabForScreen`**:
   ```ts
   if (id === 'owner-shop') return 'profile';
   ```

5. **Add render case** in `renderScreen()`:
   ```tsx
   case 'owner-shop':
     return <OwnerShopScreen onNavigate={navigate} onBack={goBack} />;
   ```

6. **Add Sidebar props** (in the `<Sidebar ... />` JSX):
   ```tsx
   onOpenShop={isOwner ? () => navigate('owner-shop') : undefined}
   shopActive={screen.id === 'owner-shop'}
   ```

### Step 11: App — Sidebar

In `Sidebar.tsx`:

Add new optional props to the interface:
```ts
onOpenShop?: () => void;
shopActive?: boolean;
```

Add a "Shop" item AFTER the Messages button but BEFORE the Create button. Since the sidebar doesn't have grouped section headers yet, use a separator approach — just add the Shop item in the nav area:

```tsx
{/* Shop — owner only, under "Commerce" */}
{isOwner && onOpenShop && (
  <button
    className={`side-tab ${shopActive ? 'active' : ''}`}
    onClick={onOpenShop}
    aria-current={shopActive ? 'page' : undefined}
  >
    <span className="ico">
      <Icon name="storefront" size={20} />
    </span>
    Shop
  </button>
)}
```

Place this after the Messages button and before the Create button in the nav section.

### Step 12: App — Owner Profile (mobile entry)

In `OwnerProfileScreen.tsx`, add to the `manageRows` array:

```tsx
{ key: 'shop', icon: <Storefront />, label: 'Shop', sub: 'Rental inventory & equipment', onClick: () => onNavigate('owner-shop') },
```

The `Storefront` inline SVG is already defined in the file (line 28). Place it after "My venues" and before "Members" in the Manage section.

### Step 13: App — OwnerShopScreen (main page)

Build the Rental Inventory page at `features/owner/OwnerShopScreen.tsx`.

**Layout inspiration**: Follow the `OwnerBookingsScreen` pattern — ScreenHeader at top, then KPI grid, then filter bar, then table/cards.

**ScreenHeader**:
```tsx
<ScreenHeader
  onBack={onBack}
  title="Rental Inventory"
  subtitle="Equipment stock and rental availability"
  action={
    <div className="flex items-center gap-2">
      <button onClick={handleExportCsv} className="...">Export CSV</button>
      <button onClick={handleAddItem} className="...">Add Item</button>
    </div>
  }
/>
```

**State**:
- `items: ApiRentalInventoryItem[]`
- `stats: RentalInventoryStats | null`
- `status: 'loading' | 'ready' | 'error'`
- `selectedVenueId: string` ('' = All Venues)
- `categoryFilter: string` ('all' | 'paddle' | 'ball' | 'gear' | 'apparel' | 'other')
- `search: string`
- `viewMode: 'table' | 'grid'` (default 'table')

**Stats cards** — 4-column grid of `KpiCard` (reusing `features/owner/components/KpiCard`). Stats are filtered by `selectedVenueId` when a specific venue is chosen. When "All Venues" is selected, stats aggregate across all venues.
```tsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-5">
  <KpiCard label="Total Stock Items" value={String(stats.totalStock)} icon="inventory_2" tone="primary" />
  <KpiCard label="Currently Rented" value={String(stats.rentedCount)} icon="trending_up" tone="coral" />
  <KpiCard label="Available Items" value={String(stats.availableStock)} icon="check_circle" tone="lime" />
  <KpiCard label="Low Stock Alerts" value={String(stats.lowStockCount)} icon="warning" tone="star" />
</div>
```

**Filter bar**:
- **Venue dropdown** (only visible if owner has multiple venues): "All Venues" default + each venue option. Uses the existing venue list from `useOwnerDashboard()` hook. Changing the venue filters stats + inventory list by `venueId`.
- Category pills using `Chip` component: All, Paddle, Ball, Gear, Apparel, Other
- Search input with placeholder "Search items, brand, SKU, or category..."
- View toggle using `Segmented`: Table | Grid — shown on `md:flex`, hidden on mobile

**Desktop — table** (`hidden md:block`):
Plain HTML `<table>` inside a `.scroll` container, matching the `OwnerBookingsScreen` table pattern:
- Columns: Item (thumbnail + name + brand), SKU, Category, Rental Price/hr, Total Stock, Available (with inline progress bar), Rented, Condition (badge), Status (badge), Actions (simple buttons: View, Edit, Archive)
- Row hover: `hover:bg-[var(--surface-2)]`
- Borders: `border-t border-[var(--hairline)]`

**Mobile — cards** (`block md:hidden`):
Stacked cards, each showing: image/placeholder, name, brand, SKU, category badge, price, available/total with progress bar, rented count, condition + status badges, action buttons.

**Data fetching** — useEffect with cancelled flag:
```tsx
useEffect(() => {
  let cancelled = false;
  setStatus('loading');
  const venueParam = selectedVenueId || undefined;
  Promise.all([
    getRentalInventoryStats({ venueId: venueParam }),
    listRentalInventory({ category: categoryFilter !== 'all' ? categoryFilter : undefined, search: search || undefined, venueId: venueParam }),
  ]).then(([s, items]) => {
    if (cancelled) return;
    setStats(s);
    setItems(items);
    setStatus('ready');
  }).catch(() => {
    if (!cancelled) setStatus('error');
  });
  return () => { cancelled = true; };
}, [categoryFilter, search, selectedVenueId]);
```

**Venue dropdown** — reuses venues from `useOwnerDashboard()`:
```tsx
const { venues } = useOwnerDashboard();
// Build dropdown options: "All Venues" + each venue
// Only show the dropdown if venues.length > 1 (single-venue owners don't need it)
```

**Form venue selector** — in the Add/Edit form, add an optional venue dropdown:
- "All Venues (shared equipment)" — sets `venueId` to null (owner-wide)
- Each specific venue — sets `venueId` to that venue's ID
- This lets owners mark items as belonging to a specific venue

**States**:
- Loading: `LoadingSkeleton variant="card" count={4}` for KPIs + `variant="list-row" count={5}` for items
- Error: `ErrorState` with retry callback that re-runs the fetch effect
- Empty: `EmptyState` with icon="inventory_2", title="No rental inventory yet", description="Add your first rental item to start tracking equipment availability.", action={label: "Add Item", onPress: handleAddItem}

### Step 14: App — InventoryItemForm (Add/Edit as BottomSheet)

Use the `BottomSheet` component for the form. Form fields using `FormField` and `FormSelect`:

Fields:
- Item name (required)
- Brand
- SKU (required)
- Category (FormSelect: Paddle/Ball/Gear/Apparel/Other)
- Description
- Image URL
- Rental price per hour (required, number >=0)
- Total stock (number >=0)
- Available stock (number >=0)
- Rented count (number >=0)
- Low stock threshold (number >=0)
- Condition (FormSelect: Excellent/Good/Fair/Needs Repair/Retired)
- Status (FormSelect: Available/Partially Rented/Fully Rented/Maintenance/Retired) — optional, auto-computed if not manually set
- Notes

Validation: name required, SKU required, category required, rentalPrice >=0, stock counts >=0, availableStock + rentedCount <= totalStock.

On save: if `editingItem` is set, call `updateRentalInventoryItem()`, else `createRentalInventoryItem()`. Refresh the list.

### Step 15: App — InventoryItemDetail (view as BottomSheet)

Read-only display of all item fields: image, name, brand, SKU, category, description, rental price, stock breakdown (total/available/rented with progress bar), condition badge, status badge, notes, created/updated dates.

### Step 16: Export CSV

```tsx
async function handleExportCsv() {
  const csv = await exportRentalInventoryCsv({ ...currentFilters });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `rental-inventory-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Step 17: Housekeeping

1. Update `app/FILEMAP.md` — add new feature files under `features/owner/`
2. Update `api/FILEMAP.md` — add `rental-inventory/` feature slice
3. Update `web/src/features/marketing/RoadmapPage.jsx` — change log entry
4. Run `npm run typecheck` in `api/` to verify
5. Run `npm run build` in `app/` to verify no TS errors
6. Restart API via `pm2 restart pickleballer-api`

## Verification

### API (curl)

```sh
# Login as owner, get token
TOKEN=$(curl -s -X POST http://localhost:9002/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"info@eunika.agency","password":"pickleball123"}' | jq -r '.data.accessToken')

# List items → 200
curl -s http://localhost:9002/api/v1/rental-inventory -H "Authorization: Bearer $TOKEN" | jq '.data | length'

# Stats → 200
curl -s http://localhost:9002/api/v1/rental-inventory/stats -H "Authorization: Bearer $TOKEN" | jq '.data'

# Create item → 201
curl -s -X POST http://localhost:9002/api/v1/rental-inventory -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":"Test Paddle","sku":"TST-001","category":"paddle","rentalPricePerHour":100,"totalStock":5,"availableStock":5}' | jq '.data.id'

# Update → 200
curl -s -X PATCH http://localhost:9002/api/v1/rental-inventory/<id> -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"availableStock":3,"rentedCount":2}' | jq '.data.status'

# Archive → 200
curl -s -X DELETE http://localhost:9002/api/v1/rental-inventory/<id> -H "Authorization: Bearer $TOKEN"

# Export CSV → 200
curl -s http://localhost:9002/api/v1/rental-inventory/export/csv -H "Authorization: Bearer $TOKEN"

# Player access → 403
curl -s http://localhost:9002/api/v1/rental-inventory -H "Authorization: Bearer $PLAYER_TOKEN"

# Unauthenticated → 401
curl -s http://localhost:9002/api/v1/rental-inventory
```

### App (browser)

- Login as owner → Shop tab visible in desktop sidebar → click → `/shop` loads with stats + seeded items
- Add Item → form opens → fill → save → item appears in list + stats update
- Edit Item → form opens prefilled → change → save → list updates
- Archive Item → confirmation → item hidden
- Export CSV → file downloads
- Login as player → NO Shop tab in sidebar → navigate to `/shop` → redirected to home
- Mobile viewport: Owner Profile → Manage → "Shop" row → tap → same page loads in card layout
