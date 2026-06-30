import { Schema, model } from 'mongoose';

const subscriptionSchema = new Schema({
  email:          { type: String, required: true, unique: true },
  userId:         { type: Schema.Types.ObjectId, ref: 'User' },
  preferences:    Schema.Types.Mixed,
  status:         { type: String, default: 'active' },
  unsubscribedAt: Date,
  source:         { type: String, maxlength: 50 },
}, { timestamps: true });

subscriptionSchema.index({ email: 1 }, { unique: true });

export const Subscription = model('Subscription', subscriptionSchema);

const auditLogSchema = new Schema({
  actorId:    { type: Schema.Types.ObjectId, ref: 'User' },
  action:     { type: String, required: true, maxlength: 50 },
  entityType: { type: String, required: true, maxlength: 50 },
  entityId:   { type: Schema.Types.ObjectId, required: true },
  oldValues:  Schema.Types.Mixed,
  newValues:  Schema.Types.Mixed,
  ipAddress:  String,
}, { timestamps: true });

auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = model('AuditLog', auditLogSchema);
