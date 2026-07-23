import { useMemo } from 'react';
import { resolveHourlyRate, perPlayerSurcharge, type RateBreakdown } from '../../shared/lib/pricing';
import { hoursBetween } from './bookingDisplay';
import type { ApiVenue, ApiCourt, OwnerHourEntry, SlotPriceOverride, AppSettings } from '../../shared/lib/api';

// Pure booking-money math, extracted from BookCourtScreen so the component owns
// UI/flow and this owns pricing. Everything here is a function of the venue/court
// context + the chosen schedule + settings — no interactive state (the payment
// option, card, etc. stay in the component).

export interface BookingPricingInput {
  venue: ApiVenue | null;
  court: ApiCourt | null;
  subUnitIndex: number | undefined;
  venueHours: OwnerHourEntry[];
  overrides: SlotPriceOverride[];
  date: string;
  startTime: string;
  endTime: string;
  isMember: boolean;
  customerCategory: 'none' | 'senior';
  playerCount: number;
  includeEquipment: boolean;
  settings: AppSettings | null;
}

/** One line-item block of consecutive hours that share a rate (blend mode). */
export interface RateGroup { startHour: number; endHour: number; rate: number; source: string }

export interface BookingPricing {
  rateInfo: RateBreakdown;
  rate: number;
  hours: number;
  blendMode: boolean;
  /** Per-rate line items when the rate varies across the window (blend mode); [] otherwise. */
  hourlyBreakdown: RateGroup[];
  equipAmount: number;
  surcharge: number;
  /** Venue price (court + equipment + per-player surcharge) — the booking `amount`. */
  subtotal: number;
  preDiscountSubtotal: number;
  discountAmount: number;
  serviceFeePercent: number;
  serviceFee: number;
  grandTotal: number;
}

export function useBookingPricing(input: BookingPricingInput): BookingPricing {
  const {
    venue, court, subUnitIndex, venueHours, overrides,
    date, startTime, endTime, isMember, customerCategory, playerCount, includeEquipment, settings,
  } = input;

  const rateInfo = useMemo(() => resolveHourlyRate({
    venue, court, subUnitIndex, hours: venueHours, overrides, date, startTime, isMember, customerCategory,
  }), [venue, court, subUnitIndex, venueHours, overrides, date, startTime, isMember, customerCategory]);
  const rate = rateInfo.rate;
  const hours = hoursBetween(startTime, endTime);

  // Pricing mode: 'start' (default) = start-time rate × hours; 'blend' = resolve
  // each clock hour independently (so bookings crossing an override boundary sum
  // correctly).
  const blendMode = settings?.pricingMode === 'blend';

  const hourlyTotal = useMemo(() => {
    if (!blendMode) return rate * hours;
    if (!startTime || !endTime) return rate * hours;
    const startH = Number(startTime.split(':')[0]);
    const endH = Number(endTime.split(':')[0]);
    if (!(endH > startH)) return 0;
    let sum = 0;
    for (let h = startH; h < endH; h++) {
      const hourStart = `${String(h).padStart(2, '0')}:00`;
      const ri = resolveHourlyRate({ venue, court, subUnitIndex, hours: venueHours, overrides, date, startTime: hourStart, isMember, customerCategory });
      sum += ri.rate;
    }
    return Math.round(sum * 100) / 100;
  }, [blendMode, startTime, endTime, rate, hours, venue, court, subUnitIndex, venueHours, overrides, date, isMember, customerCategory]);

  const preDiscountHourlyTotal = useMemo(() => {
    if (!blendMode) return rateInfo.baseRate * hours;
    const startH = Number(startTime.split(':')[0]);
    const endH = Number(endTime.split(':')[0]);
    if (!(endH > startH)) return 0;
    let sum = 0;
    for (let h = startH; h < endH; h++) {
      const hourStart = `${String(h).padStart(2, '0')}:00`;
      sum += resolveHourlyRate({ venue, court, subUnitIndex, hours: venueHours, overrides, date, startTime: hourStart, isMember, customerCategory }).baseRate;
    }
    return Math.round(sum * 100) / 100;
  }, [blendMode, rateInfo.baseRate, hours, startTime, endTime, venue, court, subUnitIndex, venueHours, overrides, date, isMember, customerCategory]);

  // Group consecutive same-rate hours so the price card can show a breakdown when
  // the rate varies across the booking window (e.g. surge on the early hours).
  const hourlyBreakdown = useMemo<RateGroup[]>(() => {
    if (!blendMode) return [];
    if (!startTime || !endTime) return [];
    const startH = Number(startTime.split(':')[0]);
    const endH = Number(endTime.split(':')[0]);
    if (!(endH > startH)) return [];
    const rows: { hour: number; rate: number; source: string }[] = [];
    for (let h = startH; h < endH; h++) {
      const hourStart = `${String(h).padStart(2, '0')}:00`;
      const ri = resolveHourlyRate({ venue, court, subUnitIndex, hours: venueHours, overrides, date, startTime: hourStart, isMember, customerCategory });
      rows.push({ hour: h, rate: ri.rate, source: ri.source });
    }
    const groups: RateGroup[] = [];
    for (const r of rows) {
      const last = groups[groups.length - 1];
      if (last && last.rate === r.rate && last.source === r.source) last.endHour = r.hour + 1;
      else groups.push({ startHour: r.hour, endHour: r.hour + 1, rate: r.rate, source: r.source });
    }
    return groups;
  }, [blendMode, startTime, endTime, venue, court, subUnitIndex, venueHours, overrides, date, isMember, customerCategory]);

  const equipAmount = includeEquipment ? (Number(venue?.equipmentRentalPrice) || 0) : 0;
  const surcharge = perPlayerSurcharge(venue, playerCount);
  // `subtotal` is the venue's price (court + equipment + per-player surcharge) —
  // what the venue earns and what's stored as the booking `amount`. The platform
  // service fee is added on top to form the grand total the player pays.
  const subtotal = Math.round((hourlyTotal + equipAmount + surcharge) * 100) / 100;
  const preDiscountSubtotal = customerCategory === 'none'
    ? subtotal
    : Math.round((preDiscountHourlyTotal + equipAmount + surcharge) * 100) / 100;
  const discountAmount = Math.round((preDiscountSubtotal - subtotal) * 100) / 100;
  const serviceFeePercent = settings?.serviceFeePercent ?? 7;
  const serviceFee = Math.round(preDiscountSubtotal * (serviceFeePercent / 100) * 100) / 100;
  const grandTotal = Math.round((subtotal + serviceFee) * 100) / 100;

  return { rateInfo, rate, hours, blendMode, hourlyBreakdown, equipAmount, surcharge, subtotal, preDiscountSubtotal, discountAmount, serviceFeePercent, serviceFee, grandTotal };
}
