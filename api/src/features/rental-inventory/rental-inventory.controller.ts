import { z } from 'zod';
import mongoose from 'mongoose';
import { RentalInventoryItem } from './rental-inventory.model.js';
import { hasPermission, effectiveOwnerId, type Permission } from '../../shared/lib/permissions.js';

// ── Zod schemas ──────────────────────────────────────────────────────────────

const createSchema = z.object({
  venueId: z.string().optional().nullable(),
  name: z.string().min(1).max(200),
  brand: z.string().max(200).optional().default(''),
  sku: z.string().min(1).max(100),
  category: z.enum(['paddle', 'ball', 'gear', 'apparel', 'other']),
  description: z.string().max(2000).optional().default(''),
  imageUrl: z.string().max(500).optional().default(''),
  rentalPricePerHour: z.number().min(0),
  totalStock: z.number().int().min(0).default(0),
  availableStock: z.number().int().min(0).default(0),
  rentedCount: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(3),
  condition: z.enum(['excellent', 'good', 'fair', 'needs_repair', 'retired']).default('good'),
  status: z.enum(['available', 'partially_rented', 'fully_rented', 'maintenance', 'retired']).optional(),
  notes: z.string().max(2000).optional().default(''),
});

const updateSchema = createSchema.partial();

const listQuerySchema = z.object({
  category: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  archived: z.coerce.boolean().optional(),
  venueId: z.string().optional(),
});

const statsQuerySchema = z.object({
  venueId: z.string().optional(),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const VIEW: Permission = 'owner.inventory.view';
const CREATE: Permission = 'owner.inventory.create';
const UPDATE: Permission = 'owner.inventory.update';
const ARCHIVE: Permission = 'owner.inventory.archive';
const EXPORT: Permission = 'owner.inventory.export';

function guard(c: any, perm: Permission) {
  const user = c.get('user');
  if (!hasPermission(user, perm)) {
    return c.json({ error: { code: 'FORBIDDEN', message: `Permission required: ${perm}` } }, 403);
  }
  return null;
}

function computeStatus(item: { status: string; availableStock: number; totalStock: number; rentedCount: number }): string {
  if (item.status === 'retired') return 'retired';
  if (item.status === 'maintenance') return 'maintenance';
  if (item.availableStock === item.totalStock && item.rentedCount === 0) return 'available';
  if (item.availableStock > 0 && item.rentedCount > 0) return 'partially_rented';
  if (item.availableStock === 0 && item.rentedCount > 0) return 'fully_rented';
  return 'available';
}

function shapeItem(doc: any) {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_id') { result.id = String(v); continue; }
    if (k === '__v') continue;
    if (v instanceof mongoose.Types.ObjectId) { result[k] = String(v); continue; }
    result[k] = v;
  }
  if (!result.id) result.id = String(obj._id);
  return result;
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/** GET / — list inventory items for the effective owner */
export async function listInventory(c: any) {
  const denied = guard(c, VIEW);
  if (denied) return denied;

  const user = c.get('user');
  const ownerId = effectiveOwnerId(user);
  const q = listQuerySchema.parse(c.req.query());

  const filter: Record<string, unknown> = { ownerId };
  if (!q.archived) filter.isArchived = false;
  if (q.category) filter.category = q.category;
  if (q.status) filter.status = q.status;
  if (q.venueId) {
    filter.$or = [{ venueId: q.venueId }, { venueId: null }];
  }
  if (q.search) {
    const escaped = q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchOr = [
      { name: { $regex: escaped, $options: 'i' } },
      { brand: { $regex: escaped, $options: 'i' } },
      { sku: { $regex: escaped, $options: 'i' } },
      { category: { $regex: escaped, $options: 'i' } },
    ];
    if (q.venueId) {
      const venueOr = filter.$or as any[];
      delete filter.$or;
      filter.$and = [{ $or: venueOr }, { $or: searchOr }];
    } else {
      filter.$or = searchOr;
    }
  }

  const items = await RentalInventoryItem.find(filter).sort({ createdAt: -1 }).lean();
  return c.json({ data: items.map(shapeItem) });
}

/** GET /stats — aggregated inventory stats for the effective owner */
export async function getInventoryStats(c: any) {
  const denied = guard(c, VIEW);
  if (denied) return denied;

  const user = c.get('user');
  const ownerId = effectiveOwnerId(user);
  const q = statsQuerySchema.parse(c.req.query());

  const match: Record<string, unknown> = { ownerId, isArchived: false };
  if (q.venueId) {
    match.$or = [{ venueId: q.venueId }, { venueId: null }];
  }

  const pipeline: any[] = [{ $match: match }];
  pipeline.push({
    $facet: {
      totals: [
        { $group: { _id: null, totalStock: { $sum: '$totalStock' }, availableStock: { $sum: '$availableStock' }, rentedCount: { $sum: '$rentedCount' } } },
      ],
      lowStock: [
        { $match: { status: { $ne: 'retired' }, $expr: { $lte: ['$availableStock', '$lowStockThreshold'] } } },
        { $count: 'count' },
      ],
    },
  });

  const [result] = await RentalInventoryItem.aggregate(pipeline);
  const totals = result?.totals[0] ?? { totalStock: 0, availableStock: 0, rentedCount: 0 };
  const lowStockCount = result?.lowStock[0]?.count ?? 0;

  return c.json({
    data: {
      totalStock: totals.totalStock,
      availableStock: totals.availableStock,
      rentedCount: totals.rentedCount,
      lowStockCount,
    },
  });
}

/** GET /:id — single item scoped to owner */
export async function getInventoryItem(c: any) {
  const denied = guard(c, VIEW);
  if (denied) return denied;

  const user = c.get('user');
  const ownerId = effectiveOwnerId(user);
  const item = await RentalInventoryItem.findOne({ _id: c.req.param('id'), ownerId }).lean();
  if (!item) return c.json({ error: { code: 'NOT_FOUND', message: 'Inventory item not found' } }, 404);

  return c.json({ data: shapeItem(item) });
}

/** POST / — create a new inventory item */
export async function createInventoryItem(c: any) {
  const denied = guard(c, CREATE);
  if (denied) return denied;

  const user = c.get('user');
  const body = createSchema.parse(await c.req.json());

  const ownerId = effectiveOwnerId(user)!;
  const status = body.status ?? computeStatus({ status: 'available', availableStock: body.availableStock, totalStock: body.totalStock, rentedCount: body.rentedCount });

  try {
    const doc = await RentalInventoryItem.create({
      venueId: body.venueId || null,
      ownerId,
      name: body.name,
      brand: body.brand,
      sku: body.sku,
      category: body.category,
      description: body.description,
      imageUrl: body.imageUrl,
      rentalPricePerHour: body.rentalPricePerHour,
      totalStock: body.totalStock,
      availableStock: body.availableStock,
      rentedCount: body.rentedCount,
      lowStockThreshold: body.lowStockThreshold,
      condition: body.condition,
      status: status as any,
      notes: body.notes,
    } as any);
    return c.json({ data: shapeItem(doc) }, 201);
  } catch (err: any) {
    if (err.code === 11000) {
      return c.json({ error: { code: 'DUPLICATE_SKU', message: 'An item with this SKU already exists in your inventory' } }, 409);
    }
    throw err;
  }
}

/** PATCH /:id — update an inventory item */
export async function updateInventoryItem(c: any) {
  const denied = guard(c, UPDATE);
  if (denied) return denied;

  const user = c.get('user');
  const ownerId = effectiveOwnerId(user);
  const body = updateSchema.parse(await c.req.json());

  const item = await RentalInventoryItem.findOne({ _id: c.req.param('id'), ownerId });
  if (!item) return c.json({ error: { code: 'NOT_FOUND', message: 'Inventory item not found' } }, 404);

  // Apply updates field-by-field
  const fields = ['name','brand','sku','category','description','imageUrl','rentalPricePerHour','totalStock','availableStock','rentedCount','lowStockThreshold','condition','status','notes'] as const;
  for (const f of fields) {
    if (body[f] !== undefined) (item as any)[f] = body[f];
  }
  if (body.venueId !== undefined) item.venueId = body.venueId ? new mongoose.Types.ObjectId(body.venueId) : null;

  // Recompute status unless manually set to maintenance/retired
  if (!body.status || (body.status !== 'maintenance' && body.status !== 'retired')) {
    item.status = computeStatus(item) as any;
  }

  // Validate stock invariants
  if (item.availableStock + item.rentedCount > item.totalStock) {
    return c.json({ error: { code: 'STOCK_INVARIANT', message: 'Available stock + rented count cannot exceed total stock' } }, 400);
  }

  try {
    await item.save();
    return c.json({ data: shapeItem(item) });
  } catch (err: any) {
    if (err.code === 11000) {
      return c.json({ error: { code: 'DUPLICATE_SKU', message: 'An item with this SKU already exists in your inventory' } }, 409);
    }
    throw err;
  }
}

/** DELETE /:id — soft-delete (archive) an inventory item */
export async function archiveInventoryItem(c: any) {
  const denied = guard(c, ARCHIVE);
  if (denied) return denied;

  const user = c.get('user');
  const ownerId = effectiveOwnerId(user);
  const item = await RentalInventoryItem.findOneAndUpdate(
    { _id: c.req.param('id'), ownerId },
    { isArchived: true },
    { new: true },
  ).lean();

  if (!item) return c.json({ error: { code: 'NOT_FOUND', message: 'Inventory item not found' } }, 404);
  return c.json({ data: shapeItem(item) });
}

/** GET /export/csv — export inventory as CSV */
export async function exportInventoryCsv(c: any) {
  const denied = guard(c, EXPORT);
  if (denied) return denied;

  const user = c.get('user');
  const ownerId = effectiveOwnerId(user);
  const q = listQuerySchema.parse(c.req.query());

  const filter: Record<string, unknown> = { ownerId };
  if (!q.archived) filter.isArchived = false;
  if (q.category) filter.category = q.category;
  if (q.status) filter.status = q.status;
  if (q.venueId) {
    filter.$or = [{ venueId: q.venueId }, { venueId: null }];
  }

  const items = await RentalInventoryItem.find(filter).sort({ createdAt: -1 }).lean();

  const headers = ['Name', 'Brand', 'SKU', 'Category', 'Rental Price/hr', 'Total Stock', 'Available', 'Rented', 'Low Stock Threshold', 'Condition', 'Status', 'Archived', 'Created'];
  const csvEscape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const rows = items.map((i: any) =>
    [i.name, i.brand, i.sku, i.category, i.rentalPricePerHour, i.totalStock, i.availableStock, i.rentedCount, i.lowStockThreshold, i.condition, i.status, i.isArchived ? 'Yes' : 'No', i.createdAt?.toISOString?.() ?? '']
      .map(csvEscape)
      .join(','),
  );

  const csv = [headers.join(','), ...rows].join('\n');

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rental-inventory-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
