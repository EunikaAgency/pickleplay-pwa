import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export interface ICoach {
  _id: Types.ObjectId;
  coachId?: string;
  slug?: string;
  userId?: Types.ObjectId;
  displayName: string;
  coachRoleLabel?: string;
  specialty?: string;
  certifications?: string[];
  certificationTier?: string;
  languages?: string[];
  location?: string;
  cityId?: Types.ObjectId;
  cityPrimary?: string;
  regionsServed?: string[];
  rateFrom?: number;
  rating?: number;
  reviewCount?: number;
  bio?: string;
  experienceYears?: number;
  coachingStyle?: string;
  duprRating?: number;
  imageUrl?: string;
  avatarUrl?: string;
  galleryImageUrls?: string[];
  isListed?: boolean;
  isLeadCoachAnywhere?: boolean;
  venues: Types.ObjectId[];
  venuesWorkedAt?: string[];
  phone?: string;
  email?: string;
  websiteUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  reclubUrl?: string;
  externalBookingUrl?: string;
  claimStatus?: string;
  isVerified?: boolean;
  sourceUrls?: string[];
  dataCompleteness?: string;
  lastVerifiedAt?: string;
  pricePrivatePerHour?: number;
  priceGroupPerPlayer?: number;
  priceCurrency?: string;
  bookingLeadTimeHours?: number;
  _importId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const coachSchema = new Schema({
  coachId:           { type: String, maxlength: 50 },
  slug:              { type: String, unique: true, maxlength: 100 },
  userId:            { type: Schema.Types.ObjectId, ref: 'User' },
  displayName:       { type: String, required: true, maxlength: 100 },
  coachRoleLabel:    { type: String, maxlength: 200 },
  specialty:         { type: String, maxlength: 100 },
  certifications:    [String],
  certificationTier: { type: String, maxlength: 20 },
  languages:         [String],
  location:          { type: String, maxlength: 100 },
  cityId:            { type: Schema.Types.ObjectId, ref: 'City' },
  cityPrimary:       { type: String, maxlength: 100 },
  regionsServed:     [String],
  rateFrom:          Number,
  rating:            { type: Number, default: 0 },
  reviewCount:       { type: Number, default: 0 },
  bio:               String,
  experienceYears:   Number,
  coachingStyle:     { type: String, maxlength: 100 },
  duprRating:        Number,
  imageUrl:          String,
  avatarUrl:         String,
  galleryImageUrls:  [String],
  isListed:          { type: Boolean, default: true },
  isLeadCoachAnywhere: Boolean,
  venues:            [{ type: Schema.Types.ObjectId, ref: 'Venue' }],
  venuesWorkedAt:    [String],
  phone:             { type: String, maxlength: 20 },
  email:             { type: String, maxlength: 255 },
  websiteUrl:        String,
  facebookUrl:       String,
  instagramUrl:      String,
  reclubUrl:         String,
  externalBookingUrl: String,
  claimStatus:       { type: String, default: 'unclaimed' },
  isVerified:        Boolean,
  sourceUrls:        [String],
  dataCompleteness:  { type: String, maxlength: 20 },
  lastVerifiedAt:    String,
  pricePrivatePerHour: Number,
  priceGroupPerPlayer: Number,
  priceCurrency:     { type: String, default: 'PHP' },
  bookingLeadTimeHours: Number,
  _importId:         { type: String, index: true },
}, { timestamps: true });

coachSchema.index({ slug: 1 });
coachSchema.index({ _importId: 1 });
coachSchema.index({ displayName: 'text', specialty: 'text', bio: 'text' });

export const Coach = model('Coach', coachSchema);

const coachServiceSchema = new Schema({
  coachId:         { type: Schema.Types.ObjectId, ref: 'Coach', required: true },
  name:            { type: String, maxlength: 100 },
  durationMinutes: Number,
  price:           { type: Number, required: true },
  description:     String,
  maxStudents:     Number,
  isActive:        { type: Boolean, default: true },
});

export const CoachService = model('CoachService', coachServiceSchema);
