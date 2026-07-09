import { Schema, model } from 'mongoose';

const rentalInventoryItemSchema = new Schema(
  {
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', default: null },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, maxlength: 200 },
    brand: { type: String, default: '' },
    sku: { type: String, required: true },
    category: {
      type: String,
      enum: ['paddle', 'ball', 'gear', 'apparel', 'other'],
      required: true,
    },
    description: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    rentalPricePerHour: { type: Number, required: true, min: 0, default: 0 },
    totalStock: { type: Number, required: true, min: 0, default: 0 },
    availableStock: { type: Number, required: true, min: 0, default: 0 },
    rentedCount: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, default: 3, min: 0 },
    condition: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'needs_repair', 'retired'],
      default: 'good',
    },
    status: {
      type: String,
      enum: ['available', 'partially_rented', 'fully_rented', 'maintenance', 'retired'],
      default: 'available',
    },
    notes: { type: String, default: '' },
    isArchived: { type: Boolean, default: false },
    // Future ecommerce fields (not surfaced in UI yet):
    salePrice: { type: Number, default: null },
    isForSale: { type: Boolean, default: false },
    ecommerceEnabled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Compound unique: SKU per owner (different owners can have same SKU)
rentalInventoryItemSchema.index({ ownerId: 1, sku: 1 }, { unique: true });
rentalInventoryItemSchema.index({ ownerId: 1, isArchived: 1 });
rentalInventoryItemSchema.index({ name: 'text', brand: 'text', sku: 'text' });

export const RentalInventoryItem = model('RentalInventoryItem', rentalInventoryItemSchema);
