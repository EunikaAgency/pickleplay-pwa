import { Schema, model } from 'mongoose';

const mediaSchema = new Schema({
  ownerType:  { type: String, maxlength: 20 },
  ownerId:    { type: Schema.Types.ObjectId },
  url:        { type: String, required: true },
  altText:    String,
  sortOrder:  { type: Number, default: 0 },
  isPrimary:  { type: Boolean, default: false },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  width:      Number,
  height:     Number,
  fileSize:   Number,
  mimeType:   { type: String, maxlength: 50 },
  _importId:  { type: String, index: true },
}, { timestamps: true });

mediaSchema.index({ ownerType: 1, ownerId: 1, sortOrder: 1 });
mediaSchema.index({ _importId: 1 });

export const Media = model('Media', mediaSchema);
