import { Schema, model } from 'mongoose';

const venueClaimSchema = new Schema({
  venueId:           { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  claimedByUserId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status:            { type: String, default: 'pending' },
  proofDescription:  String,
  proofDocumentUrls: [String],
  // Owner identity (for anti-fraud review). The claimant's legal name, their
  // role/title at the venue, and a verification contact — captured so an admin
  // can verify the person behind the claim, not just the venue link.
  claimantLegalName: { type: String, maxlength: 120 },
  claimantRole:      { type: String, maxlength: 60 },
  claimantContact:   { type: String, maxlength: 160 },
  reviewedBy:        { type: Schema.Types.ObjectId, ref: 'User' },
  reviewNotes:       String,
}, { timestamps: true });

export const VenueClaim = model('VenueClaim', venueClaimSchema);

const suggestedEditSchema = new Schema({
  venueId:           { type: Schema.Types.ObjectId, ref: 'Venue' },
  suggestedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  editType:          { type: String, required: true, maxlength: 50 },
  payloadJson:       { type: String, required: true },
  sourceNotes:       String,
  status:            { type: String, default: 'pending' },
  reviewedBy:        { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt:        Date,
}, { timestamps: true });

export const SuggestedEdit = model('SuggestedEdit', suggestedEditSchema);
