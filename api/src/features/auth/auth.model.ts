import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  passwordHash?: string;
  authProvider?: string;
  authProviderId?: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  phone?: string;
  /** Self-reported gender. The app's profile editor requires one to be set. */
  gender?: string;
  /** Date of birth as `YYYY-MM-DD`. Deliberately a string, not a Date: a
   *  birthday is a calendar date, and storing it as a UTC instant shifts it a
   *  day for anyone east/west of the server. */
  birthday?: string;
  skillLevel?: number;
  skillLevelLabel?: string;
  homeCityId?: Types.ObjectId;
  /** Postal address, captured on the profile. Required before a user can
   *  subscribe as a coach or organizer. */
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  zipcode?: string;
  roleDefault?: string;
  coachId?: Types.ObjectId;
  managedCoachId?: Types.ObjectId;
  /** For a staff sub-account: the owner who created it. Null/unset for everyone else. */
  parentOwnerUserId?: Types.ObjectId;
  /** Set false to deactivate an account (a deactivated staff member can't log in). */
  isActive?: boolean;
  bio?: string;
  isVerified?: boolean;
  privacySetting?: string;
  gcashNumber?: string;
  modePreference?: string;
  /** Set once the user finishes (or skips) first-run onboarding, so we never re-run it. */
  hasOnboarded?: boolean;
  /** Self-service account preferences (notification toggles + display units). */
  preferences?: IUserPreferences;
  lastLoginAt?: Date;
  /** Self-reported location for nearby-people discovery. */
  lat?: number;
  lng?: number;
  /** Updated on every authenticated request for presence indicators. */
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserPreferences {
  notifications?: {
    gameReminders?: boolean;
    chatMessages?: boolean;
    announcements?: boolean;
  };
  units?: 'km' | 'mi';
  searchRadiusKm?: number;
}

const userPreferencesSchema = new Schema({
  notifications: {
    type: new Schema({
      gameReminders: { type: Boolean, default: true },
      chatMessages:  { type: Boolean, default: true },
      announcements: { type: Boolean, default: true },
    }, { _id: false }),
    default: () => ({}),
  },
  units: { type: String, enum: ['km', 'mi'], default: 'km' },
  // Preferred default "Near me" radius in km, applied as the Nearby filter default.
  searchRadiusKm: { type: Number, default: 10, min: 1, max: 200 },
}, { _id: false });

const userSchema = new Schema({
  email:           { type: String, required: true, unique: true },
  passwordHash:    { type: String, maxlength: 255 },
  authProvider:    { type: String, default: 'email' },
  authProviderId:  { type: String, maxlength: 255 },
  displayName:     { type: String, required: true, maxlength: 100 },
  firstName:       { type: String, maxlength: 50 },
  lastName:        { type: String, maxlength: 50 },
  avatarUrl:       String,
  phone:           { type: String, maxlength: 20 },
  // Not `required` at the model level: every pre-existing account was created
  // without one, and a schema-level requirement would fail their next save.
  // The profile editor is what enforces that a value gets set.
  gender:          { type: String, enum: ['male', 'female'] },
  birthday:        { type: String, maxlength: 10 },
  skillLevel:      Number,
  skillLevelLabel: { type: String, maxlength: 20 },
  homeCityId:      { type: Schema.Types.ObjectId, ref: 'City' },
  address1:        { type: String, maxlength: 200 },
  address2:        { type: String, maxlength: 200 },
  city:            { type: String, maxlength: 100 },
  province:        { type: String, maxlength: 100 },
  zipcode:         { type: String, maxlength: 20 },
  roleDefault:     { type: String, default: 'player' },
  coachId:         { type: Schema.Types.ObjectId },
  managedCoachId:  { type: Schema.Types.ObjectId },
  parentOwnerUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  isActive:        { type: Boolean, default: true },
  bio:             String,
  isVerified:      { type: Boolean, default: false },
  privacySetting:  { type: String, default: 'public' },
  gcashNumber:     { type: String, maxlength: 20 },
  modePreference:  { type: String, default: 'player' },
  hasOnboarded:    { type: Boolean, default: false },
  preferences:     { type: userPreferencesSchema, default: () => ({}) },
  lat:             Number,
  lng:             Number,
  lastLoginAt:     Date,
  lastActiveAt:    Date,
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true });

export const User = model('User', userSchema);

const userRoleSchema = new Schema({
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role:      { type: String, required: true, maxlength: 30 },
  scopeType: { type: String, maxlength: 20 },
  scopeId:   { type: Schema.Types.ObjectId },
  isPrimary: { type: Boolean, default: false },
}, { timestamps: true });

userRoleSchema.index({ userId: 1, role: 1, scopeType: 1, scopeId: 1 }, { unique: true });

export const UserRole = model('UserRole', userRoleSchema);

const userDeviceSchema = new Schema({
  userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  deviceToken: { type: String, required: true },
  platform:    { type: String, maxlength: 20 },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

export const UserDevice = model('UserDevice', userDeviceSchema);

const passwordResetTokenSchema = new Schema({
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  token:     { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  usedAt:    Date,
}, { timestamps: true });

passwordResetTokenSchema.index({ token: 1 }, { unique: true });

export const PasswordResetToken = model('PasswordResetToken', passwordResetTokenSchema);

const emailVerificationTokenSchema = new Schema({
  userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  email:      { type: String, required: true },
  token:      { type: String, required: true, unique: true },
  expiresAt:  { type: Date, required: true },
  verifiedAt: Date,
}, { timestamps: true });

emailVerificationTokenSchema.index({ token: 1 }, { unique: true });

export const EmailVerificationToken = model('EmailVerificationToken', emailVerificationTokenSchema);
