import { Schema, model } from 'mongoose';

// ── Demand data capture ── a lightweight event log of player interest signals:
// searches, venue views, booking attempts, completions, cancellations, and
// empty-slot signals. The foundation for future demand-based pricing — owners
// see where interest concentrates (and where it goes unmet) per venue.
const DEMAND_EVENT_TYPES = [
  'search',             // a player ran a search (query captured)
  'venue_view',         // a venue/court detail page was opened
  'booking_attempt',    // a player started the booking flow for a venue/slot
  'booking_completed',  // a court booking was created (intent realised)
  'booking_cancelled',  // a booking was cancelled (demand lost)
  'empty_slot',         // a player hit a full/unavailable slot (unmet demand)
  'checkout_started',   // a player reached the payment step
  'checkout_abandoned', // a player left checkout without completing
  'booking_link_shared',// someone used the share/copy link for this venue
] as const;

const demandEventSchema = new Schema({
  type:      { type: String, required: true, enum: DEMAND_EVENT_TYPES, index: true },
  venueId:   { type: Schema.Types.ObjectId, ref: 'Venue', index: true },
  courtId:   { type: Schema.Types.ObjectId, ref: 'Court' },
  // The signed-in actor, when known (events are also captured for guests).
  userId:    { type: Schema.Types.ObjectId, ref: 'User' },
  // The slot the player was looking at (booking_attempt / empty_slot), for
  // demand-by-hour analysis.
  date:      { type: String },        // YYYY-MM-DD
  startHour: { type: Number, min: 0, max: 23 },
  // Free-text search query (search events), capped.
  query:     { type: String, maxlength: 200 },
  // Anything extra the caller wants to stash (small).
  meta:      { type: Schema.Types.Mixed },
}, { timestamps: true });

// Aggregations are venue + time-window scoped; this index serves them.
demandEventSchema.index({ venueId: 1, type: 1, createdAt: -1 });
demandEventSchema.index({ createdAt: -1 });

export const DemandEvent = model('DemandEvent', demandEventSchema);
export const DEMAND_TYPES = DEMAND_EVENT_TYPES;
