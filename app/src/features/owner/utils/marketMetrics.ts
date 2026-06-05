// Pure, framework-free market-comparison helpers for the owner Nearby tab
// (the "market / area map"). They operate on the same ApiVenue records the rest
// of the app uses, reusing the venue coord resolver + geo math so a venue's
// market is defined exactly like the player's "near me" search (haversine +
// radius). No data is fetched here — the screen passes in the owner's venues
// and the full venue set, and these helpers slice + aggregate it.

import type { ApiVenue } from '../../../shared/lib/api';
import { haversineKm, type LatLng } from '../../../shared/lib/geo';
import { venueCoords } from '../../../shared/lib/venueDisplay';

/** A competitor venue resolved to a point, with its distance from the focus venue. */
export interface CompetitorRow {
  venue: ApiVenue;
  coords: LatLng;
  distanceKm: number;
}

/** Where the focus venue sits on a metric relative to the area. */
export type Position = 'lowest' | 'highest' | 'mid' | 'only';

/** One headline metric: the focus value, the area average, and a positioning. */
export interface MetricStat {
  /** The focus venue's value, or null when it has no data for this metric. */
  value: number | null;
  /** Average across competitors that have data (null when none do). */
  areaAvg: number | null;
  /** How many competitors contributed to the average. */
  sampleSize: number;
  position: Position;
}

export interface MarketSummary {
  price: MetricStat;
  rating: MetricStat;
  /** Court count — `total` is the focus + competitor courts within radius. */
  courts: MetricStat & { areaTotal: number };
  /** Number of competitor venues within the radius. */
  density: number;
}

/** Resolve a venue's `[lat, lng]` (lat/lng or parsed from its Maps URL), or null. */
export function coordsOf(v: ApiVenue): LatLng | null {
  return venueCoords(v);
}

/**
 * Competitor venues within `radiusKm` of the focus venue: every locatable venue
 * except the owner's own (by id), nearest-first. When nothing falls inside the
 * radius, returns the nearest `fallbackCount` instead so the list never blanks
 * (mirrors the player Nearby screen's nearest-few fallback).
 */
export function competitorsNear(
  focusCoords: LatLng,
  allVenues: ApiVenue[],
  ownIds: Set<string>,
  radiusKm: number,
  fallbackCount = 12,
): CompetitorRow[] {
  const rows: CompetitorRow[] = [];
  for (const v of allVenues) {
    if (ownIds.has(v.id)) continue;
    const coords = coordsOf(v);
    if (!coords) continue;
    rows.push({ venue: v, coords, distanceKm: haversineKm(focusCoords, coords) });
  }
  rows.sort((a, b) => a.distanceKm - b.distanceKm);
  const within = rows.filter((r) => r.distanceKm <= radiusKm);
  return within.length ? within : rows.slice(0, fallbackCount);
}

const avg = (nums: number[]): number | null =>
  nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;

// Position the focus value against the competitor values for one metric. Lower
// price = better for the owner; higher rating/courts = better, but we only label
// the raw extreme here and let the UI phrase it.
function positionOf(value: number | null, others: number[]): Position {
  if (others.length === 0) return 'only';
  if (value == null) return 'mid';
  const min = Math.min(...others);
  const max = Math.max(...others);
  if (value <= min) return 'lowest';
  if (value >= max) return 'highest';
  return 'mid';
}

function metricStat(value: number | null, others: number[]): MetricStat {
  return {
    value,
    areaAvg: avg(others),
    sampleSize: others.length,
    position: positionOf(value, others),
  };
}

/** Build the four headline metrics for a focus venue vs its in-radius competitors. */
export function marketSummary(focus: ApiVenue, competitors: CompetitorRow[]): MarketSummary {
  const comps = competitors.map((c) => c.venue);

  const compPrices = comps.map((v) => v.priceFrom).filter((n): n is number => n != null);
  const compRatings = comps.map((v) => v.googleRating).filter((n): n is number => n != null);
  const compCourts = comps.map((v) => v.courtCount).filter((n): n is number => n != null);

  const focusCourts = focus.courtCount ?? 0;
  const areaTotal = focusCourts + compCourts.reduce((a, b) => a + b, 0);

  return {
    price: metricStat(focus.priceFrom ?? null, compPrices),
    rating: metricStat(focus.googleRating ?? null, compRatings),
    courts: { ...metricStat(focus.courtCount ?? null, compCourts), areaTotal },
    density: competitors.length,
  };
}

/** A null-safe comparison flag — omit (null) when either side lacks the value. */
export type Cmp = 'lower' | 'higher' | 'same' | null;

function cmp(a: number | null | undefined, b: number | null | undefined): Cmp {
  if (a == null || b == null) return null;
  if (a < b) return 'lower';
  if (a > b) return 'higher';
  return 'same';
}

/** How one competitor compares to the focus venue (each null when data missing). */
export interface CompetitorCompare {
  price: Cmp;
  rating: Cmp;
  courts: Cmp;
}

export function compareToFocus(competitor: ApiVenue, focus: ApiVenue): CompetitorCompare {
  return {
    price: cmp(competitor.priceFrom, focus.priceFrom),
    rating: cmp(competitor.googleRating, focus.googleRating),
    courts: cmp(competitor.courtCount, focus.courtCount),
  };
}
