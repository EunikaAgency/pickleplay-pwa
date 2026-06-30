import { Schema, model } from 'mongoose';

const citySchema = new Schema({
  slug:      { type: String, required: true, unique: true },
  name:      { type: String, required: true },
  region:    String,
  imageUrl:  String,
  venueCount:{ type: Number, default: 0 },
  hasOpenPlay:{ type: Boolean, default: false },
  isActive:  { type: Boolean, default: true },
  _importId: { type: String, index: true },
}, { timestamps: true });

citySchema.index({ slug: 1 });
citySchema.index({ _importId: 1 });

export const City = model('City', citySchema);
