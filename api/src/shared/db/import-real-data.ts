// Pickleballers API — Real Data Import
// Loads scraped venue + coach handoff CSVs from real-data/handoff into MongoDB.
// Re-runnable: wipes target collections before inserting.
//
// Usage: npm run db:import

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { City } from '../../features/cities/cities.model.js';
import { Venue, VenueHour, Court } from '../../features/venues/venues.model.js';
import { Coach } from '../../features/coaches/coaches.model.js';
import { VenuePricing } from '../../features/payments/payments.model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// __dirname is src/shared/db; api root is three levels up.
const apiRoot = path.resolve(__dirname, '../../../');
const handoffDir = path.join(apiRoot, 'real-data/handoff');
const handoffImagesDir = path.join(handoffDir, 'images');
const uploadsDir = path.join(apiRoot, 'uploads');
const IMPORT_ID = `handoff-${new Date().toISOString().slice(0, 10)}`;

type Row = Record<string, string>;

function readCsv(file: string): Row[] {
  const p = path.join(handoffDir, file);
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, 'utf-8');
  return parse(raw, { columns: true, skip_empty_lines: true, trim: true }) as Row[];
}

const blankToUndef = (v: string | undefined): string | undefined =>
  v == null || v === '' ? undefined : v;

const pipeList = (v: string | undefined): string[] | undefined => {
  const s = blankToUndef(v);
  if (!s) return undefined;
  return s.split('|').map((x) => x.trim()).filter(Boolean);
};

// CSVs use TRUE / FALSE / unknown / empty.
// triState keeps the string (for amenity_* and has_* fields typed as String in the schema).
// boolish returns boolean | undefined (for Boolean fields).
const triState = (v: string | undefined): string | undefined => {
  const s = blankToUndef(v);
  if (!s) return undefined;
  const u = s.toUpperCase();
  if (u === 'TRUE' || u === 'FALSE' || u === 'UNKNOWN') return u.toLowerCase();
  return s;
};

const boolish = (v: string | undefined): boolean | undefined => {
  const s = blankToUndef(v);
  if (!s) return undefined;
  const u = s.toUpperCase();
  if (u === 'TRUE') return true;
  if (u === 'FALSE') return false;
  return undefined;
};

const numish = (v: string | undefined): number | undefined => {
  const s = blankToUndef(v);
  if (s == null) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

const intish = (v: string | undefined): number | undefined => {
  const n = numish(v);
  return n == null ? undefined : Math.trunc(n);
};

// Phones come in messy: "0917 875 6216 (assoc office)". Drop trailing
// parenthetical/annotation and clamp to the schema's 20-char cap.
const phoneish = (v: string | undefined): string | undefined => {
  const s = blankToUndef(v);
  if (!s) return undefined;
  const trimmed = s.split('(')[0]!.trim();
  return trimmed.slice(0, 20);
};

const citySlug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Bypass Mongoose validators for the import. The handoff CSV is the source of
// truth and includes pre-vetted strings that occasionally exceed schema
// maxlength caps (messy phone fields, long surface descriptions, etc).
async function importCreate(Model: any, data: any): Promise<any> {
  const doc = new Model(data);
  return doc.save({ validateBeforeSave: false });
}

// Mirror real-data/handoff/images/** into api/uploads/images/**. Re-runnable:
// skips files that already exist with the same size. Returns counts so the
// caller can log progress (and warn if the source bundle isn't on disk).
function copyImagePayload(): { copied: number; skipped: number; sourceMissing: boolean } {
  if (!fs.existsSync(handoffImagesDir)) {
    return { copied: 0, skipped: 0, sourceMissing: true };
  }
  const targetRoot = path.join(uploadsDir, 'images');
  fs.mkdirSync(targetRoot, { recursive: true });

  let copied = 0;
  let skipped = 0;

  function walk(srcDir: string, dstDir: string) {
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
      const src = path.join(srcDir, entry.name);
      const dst = path.join(dstDir, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(dst, { recursive: true });
        walk(src, dst);
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        const srcStat = fs.statSync(src);
        if (fs.existsSync(dst) && fs.statSync(dst).size === srcStat.size) {
          skipped++;
          continue;
        }
        fs.copyFileSync(src, dst);
        copied++;
      } catch {
        // ignore individual file errors; the next run will retry
      }
    }
  }

  walk(handoffImagesDir, targetRoot);
  return { copied, skipped, sourceMissing: false };
}

async function run() {
  console.log(`🚀 Importing real handoff data from ${handoffDir}`);
  console.log(`   _importId: ${IMPORT_ID}\n`);

  await connectDb();

  /* ─── Wipe previously imported collections ──────────────────── */
  console.log('  Wiping target collections...');
  for (const name of ['venuepricings', 'courts', 'venuehours', 'venues', 'coaches', 'cities']) {
    try {
      await mongoose.connection.db?.dropCollection(name);
    } catch {
      /* may not exist yet */
    }
  }

  /* ─── Read CSVs ─────────────────────────────────────────────── */
  const venuesCsv = readCsv('venues.csv');
  const pricingCsv = readCsv('venue_pricing.csv');
  const courtsCsv = readCsv('venue_courts.csv');
  const imagesCsv = readCsv('venue_images.csv');
  const coachesCsv = readCsv('coaches.csv');

  console.log(`  Read venues=${venuesCsv.length} pricing=${pricingCsv.length} courts=${courtsCsv.length} images=${imagesCsv.length} coaches=${coachesCsv.length}\n`);

  /* ─── Copy image payload (handoff/images/ → api/uploads/images/) ─ */
  // The CSV stores /images/venues/<slug>/<file> URLs; the API serves
  // them from uploads/. If the JPEG bundle isn't on disk yet, this
  // is a no-op — the URLs in Mongo will 404 until files arrive.
  const imageStats = copyImagePayload();
  if (imageStats.sourceMissing) {
    console.log(`  ⚠ No image payload at ${handoffImagesDir} — uploads/ stays empty.\n`);
  } else {
    console.log(`  Images: copied=${imageStats.copied} skipped=${imageStats.skipped} (uploads/${'images'})\n`);
  }

  /* ─── Cities (derived from venues) ──────────────────────────── */
  console.log('  Inserting cities...');
  const cityCounts = new Map<string, { name: string; region?: string; count: number }>();
  for (const v of venuesCsv) {
    const name = blankToUndef(v.city);
    if (!name) continue;
    const slug = citySlug(name);
    if (!cityCounts.has(slug)) {
      cityCounts.set(slug, { name, region: blankToUndef(v.region), count: 0 });
    }
    cityCounts.get(slug)!.count += 1;
  }

  const cityIdBySlug = new Map<string, mongoose.Types.ObjectId>();
  for (const [slug, c] of cityCounts) {
    const doc = await importCreate(City, {
      slug,
      name: c.name,
      region: c.region,
      venueCount: c.count,
      hasOpenPlay: true,
      isActive: true,
      _importId: IMPORT_ID,
    });
    cityIdBySlug.set(slug, doc._id);
  }

  /* ─── Image manifest → per-venue main + gallery ─────────────── */
  const imagesByVenueSlug = new Map<string, { hero?: string; gallery: { pos: number; path: string }[] }>();
  for (const img of imagesCsv) {
    const slug = blankToUndef(img.venue_slug);
    const web = blankToUndef(img.web_path);
    if (!slug || !web) continue;
    if (!imagesByVenueSlug.has(slug)) imagesByVenueSlug.set(slug, { gallery: [] });
    const bucket = imagesByVenueSlug.get(slug)!;
    const webUrl = '/' + web.replace(/^\/+/, '');
    if (img.role === 'hero') {
      bucket.hero = webUrl;
    } else {
      bucket.gallery.push({ pos: intish(img.position) ?? 0, path: webUrl });
    }
  }
  for (const v of imagesByVenueSlug.values()) {
    v.gallery.sort((a, b) => a.pos - b.pos);
  }

  /* ─── Venues ────────────────────────────────────────────────── */
  console.log('  Inserting venues...');
  const venueObjIdByCsvId = new Map<string, mongoose.Types.ObjectId>();
  const venueObjIdBySlug = new Map<string, mongoose.Types.ObjectId>();
  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  for (const v of venuesCsv) {
    const slug = v.slug?.trim();
    if (!slug) continue;
    const cityName = blankToUndef(v.city);
    const cityIdRef = cityName ? cityIdBySlug.get(citySlug(cityName)) : undefined;
    const img = imagesByVenueSlug.get(slug);

    const doc = await importCreate(Venue, {
      slug,
      displayName: v.venue_name,
      venueId: blankToUndef(v.venue_id),
      venueType: blankToUndef(v.venue_type),
      listingStatus: blankToUndef(v.listing_status),
      isVerified: boolish(v.is_verified),
      alternateNames: pipeList(v.alternate_names),
      cityId: cityIdRef,
      area: blankToUndef(v.area),
      country: blankToUndef(v.country),
      region: blankToUndef(v.region),
      fullAddress: blankToUndef(v.full_address),
      postalCode: blankToUndef(v.postal_code),
      googleMapsUrl: blankToUndef(v.google_maps_url),
      directionsShort: blankToUndef(v.directions_short),
      state: blankToUndef(v.claim_status) || 'unclaimed',
      indoorOutdoor: blankToUndef(v.indoor_outdoor),
      coveredUncovered: blankToUndef(v.covered_uncovered),
      courtCount: intish(v.court_count) ?? 0,
      surfaceType: blankToUndef(v.surface_type),

      hasDedicatedLines: triState(v.has_dedicated_lines),
      hasPermanentNets: triState(v.has_permanent_nets),
      hasOpenPlay: boolish(v.has_open_play),
      hasCoaching: boolish(v.has_coaching),
      hasCourtRental: boolish(v.has_court_rental),
      isBeginnerFriendly: boolish(v.is_beginner_friendly),
      allowsWalkins: triState(v.allows_walkins),

      // Boolean conveniences derived from amenity_* string fields
      hasParking: boolish(v.amenity_parking),
      hasShowers: boolish(v.amenity_showers),
      hasFoodBeverage: boolish(v.amenity_cafe_food),
      hasAc: boolish(v.amenity_air_conditioning),
      hasLighting: boolish(v.amenity_tournament_lighting),
      hasSeating: boolish(v.amenity_seating_area),
      hasPaddleRental: boolish(v.amenity_paddle_rental),
      hasProShop: boolish(v.amenity_pro_shop),

      // Original 3-state amenity strings
      amenityAirConditioning: triState(v.amenity_air_conditioning),
      amenityTournamentLighting: triState(v.amenity_tournament_lighting),
      amenityParking: triState(v.amenity_parking),
      amenityShowers: triState(v.amenity_showers),
      amenityLockers: triState(v.amenity_lockers),
      amenitySeatingArea: triState(v.amenity_seating_area),
      amenityWaterRefill: triState(v.amenity_water_refill),
      amenityCafeFood: triState(v.amenity_cafe_food),
      amenityPaddleRental: triState(v.amenity_paddle_rental),
      amenityProShop: triState(v.amenity_pro_shop),
      amenityWifi: triState(v.amenity_wifi),
      amenityCoveredTerrace: triState(v.amenity_covered_terrace),

      priceFrom: numish(v.price_from_amount),
      priceType: blankToUndef(v.price_from_unit),
      priceFromLabel: blankToUndef(v.price_from_label),
      priceNotes: blankToUndef(v.pricing_notes),
      priceLastVerified: blankToUndef(v.pricing_last_verified_at),
      primaryPricingModel: blankToUndef(v.primary_pricing_model),
      pricingCurrency: blankToUndef(v.pricing_currency) || 'PHP',
      bookingSlotMinutes: intish(v.booking_slot_minutes),
      bookingAdvanceWindowDays: intish(v.booking_advance_window_days) ?? 14,
      acceptsWalkIns: boolish(v.accepts_walk_ins),
      pricingBlocksLastVerifiedAt: blankToUndef(v.pricing_blocks_last_verified_at),

      phonePrimary: phoneish(v.phone_primary),
      phoneSecondary: phoneish(v.phone_secondary),
      phone: phoneish(v.phone_primary),
      email: blankToUndef(v.email),
      website: blankToUndef(v.website_url),
      facebookUrl: blankToUndef(v.facebook_url),
      instagramUrl: blankToUndef(v.instagram_url),
      viberUrl: blankToUndef(v.viber_url),
      reclubUrl: blankToUndef(v.reclub_url),
      externalBookingUrl: blankToUndef(v.external_booking_url),
      externalBookingProvider: blankToUndef(v.external_booking_provider),
      bookingUrl: blankToUndef(v.external_booking_url),

      lat: numish(v.latitude),
      lng: numish(v.longitude),

      customTagline: blankToUndef(v.custom_tagline),
      customHighlights: pipeList(v.custom_highlights),
      customCaveats: pipeList(v.custom_caveats),
      editorialNote: blankToUndef(v.editorial_note),

      mainImageUrl: img?.hero ?? blankToUndef(v.main_image_url),
      galleryImageUrls: img?.gallery.length ? img.gallery.map((g) => g.path) : pipeList(v.gallery_image_urls),
      imageCredits: pipeList(v.image_credits),
      sourceUrls: pipeList(v.source_urls),

      dataCompleteness: blankToUndef(v.data_completeness),
      dataQualityNotes: blankToUndef(v.data_quality_notes),
      lastVerifiedAt: blankToUndef(v.last_verified_at),
      hoursTimezone: blankToUndef(v.hours_timezone) || 'Asia/Manila',
      hoursLastVerifiedAt: blankToUndef(v.hours_last_verified_at),

      _importId: IMPORT_ID,
    });

    venueObjIdBySlug.set(slug, doc._id);
    if (v.venue_id) venueObjIdByCsvId.set(v.venue_id, doc._id);

    // Hours: one VenueHour per day where we have data.
    for (let i = 0; i < dayOrder.length; i++) {
      const day = dayOrder[i];
      const open = blankToUndef(v[`hours_${day}_open`]);
      const close = blankToUndef(v[`hours_${day}_close`]);
      const note = blankToUndef(v[`hours_${day}_note`]);
      if (!open && !close && !note) continue;
      const closed = (open?.toLowerCase() === 'closed') || (close?.toLowerCase() === 'closed');
      await importCreate(VenueHour, {
        venueId: doc._id,
        dayOfWeek: i,
        openTime: closed ? undefined : open,
        closeTime: closed ? undefined : close,
        isClosed: closed,
        notes: note,
        _importId: IMPORT_ID,
      });
    }
  }

  /* ─── Courts ────────────────────────────────────────────────── */
  console.log('  Inserting courts...');
  let courtCount = 0;
  for (const c of courtsCsv) {
    if (!c.venue_id) continue;
    const venueObjId = venueObjIdByCsvId.get(c.venue_id);
    if (!venueObjId) continue;
    await importCreate(Court, {
      venueId: venueObjId,
      courtNumber: c.court_number || c.court_id,
      courtName: blankToUndef(c.court_name),
      surfaceType: blankToUndef(c.surface),
      isActive: true,
      _importId: IMPORT_ID,
    });
    courtCount++;
  }

  /* ─── Pricing blocks ────────────────────────────────────────── */
  console.log('  Inserting pricing blocks...');
  let pricingCount = 0;
  for (const p of pricingCsv) {
    if (!p.venue_id) continue;
    const venueObjId = venueObjIdByCsvId.get(p.venue_id);
    if (!venueObjId) continue;
    await importCreate(VenuePricing, {
      pricingId: blankToUndef(p.pricing_id),
      venueId: venueObjId,
      pricingModel: p.pricing_model || 'unknown',
      label: p.label || '(unlabeled)',
      price: numish(p.price),
      currency: blankToUndef(p.currency) || 'PHP',
      days: pipeList(p.days),
      timeStart: blankToUndef(p.time_start),
      timeEnd: blankToUndef(p.time_end),
      durationMinutes: intish(p.duration_minutes),
      tierAudience: blankToUndef(p.tier_audience),
      groupSizeMin: intish(p.group_size_min),
      groupSizeMax: intish(p.group_size_max),
      sourceUrl: blankToUndef(p.source_url),
      notes: blankToUndef(p.notes),
      _importId: IMPORT_ID,
    });
    pricingCount++;
  }

  /* ─── Coaches ───────────────────────────────────────────────── */
  console.log('  Inserting coaches...');
  for (const c of coachesCsv) {
    const cityName = blankToUndef(c.city_primary);
    const cityRef = cityName ? cityIdBySlug.get(citySlug(cityName)) : undefined;
    const venuesWorkedAt = pipeList(c.venues_worked_at) ?? [];
    const venueRefs = venuesWorkedAt
      .map((vid) => venueObjIdByCsvId.get(vid))
      .filter((x): x is mongoose.Types.ObjectId => !!x);

    await importCreate(Coach, {
      coachId: blankToUndef(c.coach_id),
      slug: c.slug || c.coach_id,
      displayName: c.coach_name,
      coachRoleLabel: blankToUndef(c.coach_role_label),
      bio: blankToUndef(c.coach_bio),
      duprRating: numish(c.coach_dupr_rating),
      experienceYears: intish(c.years_coaching),
      certifications: pipeList(c.certifications),
      specialty: pipeList(c.specialties)?.[0],
      languages: pipeList(c.languages),
      cityPrimary: cityName,
      cityId: cityRef,
      location: cityName,
      regionsServed: pipeList(c.regions_served),
      venuesWorkedAt,
      venues: venueRefs,
      pricePrivatePerHour: numish(c.price_private_per_hour),
      priceGroupPerPlayer: numish(c.price_group_per_player),
      rateFrom: numish(c.price_private_per_hour) ?? numish(c.price_group_per_player),
      priceCurrency: blankToUndef(c.price_currency) || 'PHP',
      bookingLeadTimeHours: intish(c.booking_lead_time_hours),
      phone: phoneish(c.phone),
      email: blankToUndef(c.email),
      websiteUrl: blankToUndef(c.website_url),
      facebookUrl: blankToUndef(c.facebook_url),
      instagramUrl: blankToUndef(c.instagram_url),
      reclubUrl: blankToUndef(c.reclub_url),
      externalBookingUrl: blankToUndef(c.external_booking_url),
      avatarUrl: blankToUndef(c.avatar_url),
      imageUrl: blankToUndef(c.avatar_url),
      galleryImageUrls: pipeList(c.gallery_image_urls),
      claimStatus: blankToUndef(c.claim_status) || 'unclaimed',
      isVerified: boolish(c.is_verified),
      isLeadCoachAnywhere: boolish(c.is_lead_coach_anywhere),
      sourceUrls: pipeList(c.source_urls),
      dataCompleteness: blankToUndef(c.data_completeness),
      lastVerifiedAt: blankToUndef(c.last_verified_at),
      isListed: true,
      _importId: IMPORT_ID,
    });
  }

  console.log('\n✅ Import complete.');
  console.log(`   Cities:        ${cityIdBySlug.size}`);
  console.log(`   Venues:        ${venueObjIdBySlug.size}`);
  console.log(`   Courts:        ${courtCount}`);
  console.log(`   Pricing rows:  ${pricingCount}`);
  console.log(`   Coaches:       ${coachesCsv.length}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});
