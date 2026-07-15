// Maps booking API failures to friendly, actionable copy. The server returns
// structured error codes on createBooking/checkout (see
// api/src/features/bookings/bookings.controller.ts), so we key off ApiError.code
// rather than regex-matching messages. `backToStep0` tells the wizard to send the
// user back to the court-&-time step (the slot/price changed under them).

import { ApiError } from '../../shared/lib/api';

export interface MappedBookingError {
  message: string;
  /** Bounce the user back to Step 0 so they can pick a fresh slot / see the new price. */
  backToStep0: boolean;
}

const GENERIC = 'Could not complete your booking. Please try again.';

export function mapBookingError(e: unknown): MappedBookingError {
  const code = e instanceof ApiError ? e.code : '';
  switch (code) {
    case 'SLOT_CONFLICT':
      return { message: 'That court was just booked for this time — please pick another slot.', backToStep0: true };
    case 'PAST_SLOT':
      return { message: 'That time has already passed — please pick a later time.', backToStep0: true };
    case 'PRICE_MISMATCH':
      return { message: 'The price changed while you were booking — please review the updated total and try again.', backToStep0: true };
    case 'CARD_DECLINED':
      return { message: e instanceof ApiError && e.message ? e.message : 'Card declined — in demo mode use the test card 4242 4242 4242 4242.', backToStep0: false };
    case 'NOT_FOUND':
      return { message: 'This court is no longer available.', backToStep0: false };
    default:
      return { message: e instanceof Error && e.message ? e.message : GENERIC, backToStep0: false };
  }
}
