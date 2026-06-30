import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export interface IRole {
  _id: Types.ObjectId;
  key: string;
  label: string;
  description?: string;
  permissions: string[];
  // Venues associated with this role. Only meaningful for the coach role today
  // (the admin Roles & permissions page surfaces a venue picker for it).
  venues: Types.ObjectId[];
  isSystem: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema({
  key:         { type: String, required: true, unique: true, maxlength: 40 },
  label:       { type: String, required: true, maxlength: 60 },
  description: { type: String, maxlength: 200, default: '' },
  permissions: { type: [String], default: [] },
  venues:      [{ type: Schema.Types.ObjectId, ref: 'Venue' }],
  isSystem:    { type: Boolean, default: false },
  sortOrder:   { type: Number, default: 100 },
}, { timestamps: true });

roleSchema.index({ key: 1 }, { unique: true });

export const Role = model('Role', roleSchema);
