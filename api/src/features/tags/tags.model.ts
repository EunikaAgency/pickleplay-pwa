import { Schema, model } from 'mongoose';

const tagSchema = new Schema({
  slug:       { type: String, unique: true },
  displayName:{ type: String, required: true },
  tagType:    { type: String, maxlength: 20 },
}, { timestamps: true });

tagSchema.index({ slug: 1 });

export const Tag = model('Tag', tagSchema);
