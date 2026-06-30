// Pickleballers API — Database Seed Script
// Loads representative data matching the frontend mock data shapes.
// Designed to be re-runnable: drops existing data before inserting.
//
// Usage: npm run db:seed
//        NODE_ENV=development tsx src/db/seed.ts

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDb } from './index.js';
import { City } from '../../features/cities/cities.model.js';
import { Venue, VenueHour, Faq } from '../../features/venues/venues.model.js';
import { Coach, CoachService } from '../../features/coaches/coaches.model.js';
import { OpenPlaySession, Tournament, Event, Post } from '../../features/content/content.model.js';
import { Review } from '../../features/interactions/interactions.model.js';
import { Booking } from '../../features/bookings/bookings.model.js';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockDir = path.resolve(__dirname, '../../../data');

/* ─── Helpers ──────────────────────────────────────────────────── */

function loadMockData(): Record<string, any> {
  const files = [
    'cities.js', 'venues.js', 'coaches.js', 'open-play.js',
    'tournaments.js', 'events.js', 'reviews.js', 'bookings.js',
    'notifications.js', 'guides.js',
  ];

  let bundle = '';
  for (const f of files) {
    const p = path.join(mockDir, f);
    if (!fs.existsSync(p)) continue;
    bundle += fs.readFileSync(p, 'utf-8') + '\n';
  }

  bundle = bundle.replace(
    /\b(const|let)\s+(MOCK_\w+|MOCK_IMAGES)\s*=\s*/g,
    'var $2 = mockData.$2 = ',
  );

  const mockData: Record<string, any> = {};
  const fn = new Function('mockData', bundle);
  fn(mockData);

  return mockData;
}

/* ─── Main Seed ────────────────────────────────────────────────── */

async function seed() {
  await connectDb();
  console.log('🌱 Seeding database...\n');

  const mock = loadMockData();
  const mockVenues: any[] = mock.MOCK_VENUES || [];
  const mockCoaches: any[] = mock.MOCK_COACHES || [];
  const mockSessions: any[] = mock.MOCK_OPEN_PLAY || [];
  const mockTournaments: any[] = mock.MOCK_TOURNAMENTS || [];
  const mockEvents: any[] = mock.MOCK_EVENTS || [];
  const mockReviews: Record<string, any> = mock.MOCK_REVIEWS || {};
  const mockBookings: any[] = mock.MOCK_BOOKINGS || [];
  const mockGuides: any[] = mock.MOCK_GUIDES || [];

  /* ─── Clear existing data (reverse dependency order) ──────────── */

  console.log('  Clearing existing data...');
  const collections = [
    'coachreviews', 'coachservices', 'reviews',
    'bookings', 'tournamentregistrations', 'eventregistrations', 'payments',
    'openplaysessions', 'tournaments', 'events', 'posts',
    'venuehours', 'courts', 'faqs', 'holidayclosures',
    'venuestaff', 'venueclaims', 'suggestededits', 'venues', 'coaches',
    'cities',
  ];
  for (const name of collections) {
    try { await mongoose.connection.db?.dropCollection(name); } catch { /* may not exist */ }
  }

  /* ─── Cities ──────────────────────────────────────────────────── */

  console.log('  Inserting cities...');
  const citySlugMap = new Map<string, string>();

  const seen = new Set<string>();
  const cityData: Array<{ slug: string; name: string }> = [];
  for (const v of mockVenues) {
    const name = v.city;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    citySlugMap.set(name, slug);
    cityData.push({ slug, name });
  }

  if (!cityData.length) {
    cityData.push(
      { slug: 'makati', name: 'Makati' },
      { slug: 'quezon-city', name: 'Quezon City' },
      { slug: 'taguig', name: 'Taguig' },
      { slug: 'mandaluyong', name: 'Mandaluyong' },
      { slug: 'pasig', name: 'Pasig' },
    );
  }

  const insertedCities: Array<{ _id: mongoose.Types.ObjectId; name: string; slug: string }> = [];
  for (const c of cityData) {
    const img = mock.MOCK_IMAGES?.cities?.[cityData.indexOf(c) % mock.MOCK_IMAGES.cities.length] || '';
    const doc = await City.create({
      slug: c.slug,
      name: c.name,
      imageUrl: img,
      venueCount: mockVenues.filter(v => v.city === c.name).length,
      hasOpenPlay: true,
      isActive: true,
    });
    insertedCities.push({ _id: doc._id, name: doc.name, slug: doc.slug });
  }

  const cityByName = new Map(insertedCities.map(c => [c.name, c._id]));
  const cityBySlug = new Map(insertedCities.map(c => [c.slug, c._id]));

  /* ─── Venues ──────────────────────────────────────────────────── */

  console.log('  Inserting venues...');
  const venueIdBySlug = new Map<string, mongoose.Types.ObjectId>();

  for (const v of mockVenues) {
    const cityId = cityByName.get(v.city) || null;
    const venue = await Venue.create({
      slug: v.slug,
      displayName: v.displayName,
      cityId,
      area: v.area,
      state: v.state || 'unclaimed',
      oneLineSummary: v.oneLineSummary,
      description: v.description,
      bestFor: v.bestFor || [],
      whatPlayersLike: v.whatPlayersLike || [],
      thingsToKnow: v.thingsToKnow || [],
      indoorOutdoor: v.indoorOutdoor,
      coveredUncovered: v.coveredUncovered,
      courtCount: v.courtCount || 0,
      surfaceType: v.surfaceType,
      hasOpenPlay: v.hasOpenPlay || false,
      hasCoaching: v.hasCoaching || false,
      hasCourtRental: v.hasCourtRental || false,
      isBeginnerFriendly: v.isBeginnerFriendly || false,
      hasParking: v.hasParking || false,
      hasToilets: v.hasToilets || false,
      hasShowers: v.hasShowers || false,
      hasFoodBeverage: v.hasFoodBeverage || false,
      hasAc: v.hasAc || false,
      hasLighting: v.hasLighting || false,
      hasSeating: v.hasSeating || false,
      hasPaddleRental: v.hasPaddleRental || false,
      hasProShop: v.hasProShop || false,
      amenityChips: v.amenityChips || [],
      priceFrom: v.priceFrom ? Number(v.priceFrom) : undefined,
      priceType: v.priceType,
      peakPrice: v.peakPrice ? Number(v.peakPrice) : undefined,
      offPeakPrice: v.offPeakPrice ? Number(v.offPeakPrice) : undefined,
      openPlayPrice: v.openPlayPrice ? Number(v.openPlayPrice) : undefined,
      equipmentRentalPrice: (v.equipmentRental || v.equipmentRentalPrice) ? Number(v.equipmentRental || v.equipmentRentalPrice) : undefined,
      priceNotes: v.priceNotes,
      priceLastVerified: v.priceLastVerified ? new Date(v.priceLastVerified).toISOString().split('T')[0] : undefined,
      phone: v.phone,
      email: v.email,
      website: v.website,
      bookingUrl: v.bookingUrl,
      lat: v.lat ? Number(v.lat) : undefined,
      lng: v.lng ? Number(v.lng) : undefined,
      googleRating: v.googleRating ? Number(v.googleRating) : undefined,
      googleReviewCount: v.googleReviewCount || undefined,
    });

    venueIdBySlug.set(v.slug, venue._id);

    // Insert venue hours
    if (v.hours) {
      const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      for (const [dayName, dayRange] of Object.entries(v.hours)) {
        const idx = dayNames.indexOf(dayName);
        if (idx === -1) continue;
        if (dayRange === 'Closed') {
          await VenueHour.create({ venueId: venue._id, dayOfWeek: idx, isClosed: true });
        } else if (typeof dayRange === 'string' && dayRange.includes('–')) {
          const [open = '', close = ''] = dayRange.split('–').map((s: string) => s.trim());
          await VenueHour.create({
            venueId: venue._id,
            dayOfWeek: idx,
            openTime: convertToTime(open),
            closeTime: convertToTime(close),
          });
        }
      }
    }

    // Insert FAQs
    if (v.faqs?.length) {
      for (const f of v.faqs) {
        await Faq.create({ venueId: venue._id, question: f.q, answer: f.a });
      }
    }
  }

  /* ─── Coaches ─────────────────────────────────────────────────── */

  console.log('  Inserting coaches...');
  const coachIdByMock = new Map<string, mongoose.Types.ObjectId>();

  for (const c of mockCoaches) {
    // Resolve venue ObjectIds (coach.venues array ref, no junction table)
    const venueIds = (c.venueIds || []).map((slug: string) => venueIdBySlug.get(slug)).filter(Boolean);

    const coach = await Coach.create({
      slug: c.slug || c.id,
      displayName: c.name,
      specialty: c.specialty,
      certifications: c.certifications || [],
      certificationTier: c.certificationTier,
      location: c.location,
      rateFrom: c.rate ? Number(c.rate) : undefined,
      rating: c.rating ? Number(c.rating) : 0,
      reviewCount: c.reviewCount || 0,
      bio: c.bio,
      experienceYears: parseInt(c.experience) || undefined,
      coachingStyle: c.style,
      imageUrl: c.image,
      isListed: true,
      venues: venueIds,
    });

    coachIdByMock.set(c.id, coach._id);

    // Coach Services
    if (c.services?.length) {
      for (const svc of c.services) {
        const duration = typeof svc.duration === 'string'
          ? parseInt(svc.duration) || undefined
          : svc.duration;
        await CoachService.create({
          coachId: coach._id,
          name: svc.name,
          durationMinutes: duration,
          price: Number(svc.price),
          description: svc.description,
        });
      }
    }
  }

  /* ─── Open Play Sessions ──────────────────────────────────────── */

  console.log('  Inserting open play sessions...');
  for (const s of mockSessions) {
    const venueId = venueIdBySlug.get(s.venueId);
    if (!venueId) continue;

    let sessionDate = new Date();
    if (s.date === 'Today') { /* keep today */ }
    else if (s.date === 'Tomorrow') {
      sessionDate.setDate(sessionDate.getDate() + 1);
    } else if (s.date === 'Sat') {
      sessionDate.setDate(sessionDate.getDate() + ((6 - sessionDate.getDay() + 7) % 7));
    } else if (s.date === 'Sun') {
      sessionDate.setDate(sessionDate.getDate() + ((0 - sessionDate.getDay() + 7) % 7));
    } else {
      const parsed = new Date(s.date);
      if (!isNaN(parsed.getTime())) sessionDate = parsed;
    }

    const [startTime] = (s.time || '00:00').split(' – ');

    await OpenPlaySession.create({
      title: s.title,
      slug: `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      venueId,
      date: sessionDate.toISOString().split('T')[0],
      startTime: convertToTime(startTime) || startTime,
      levelLabel: s.level,
      levelColor: s.levelColor,
      price: Number(s.price) || 0,
      capacity: s.capacity || 20,
      joinedCount: s.joined || 0,
      status: s.status || 'published',
      organizerName: s.organizer,
    });
  }

  /* ─── Tournaments ─────────────────────────────────────────────── */

  console.log('  Inserting tournaments...');
  for (const t of mockTournaments) {
    const venueId = venueIdBySlug.get(t.venueId);
    if (!venueId) continue;

    const startDate = parseDate(t.date || t.startDate);
    const endDate = parseDate(t.endDate) || startDate;

    await Tournament.create({
      slug: `tournament-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: t.name || t.title,
      venueId,
      startDate: startDate || new Date().toISOString().split('T')[0],
      endDate,
      skillLevel: t.skillLevel,
      format: t.format,
      price: Number(t.price) || 0,
      registeredPlayers: t.registered || 0,
      maxPlayers: t.maxPlayers || t.capacity,
      status: 'open',
      description: t.description,
      organizer: t.organizer,
      isFeatured: t.isFeatured || false,
      imageUrl: t.image,
    });
  }

  /* ─── Events ──────────────────────────────────────────────────── */

  console.log('  Inserting events...');
  for (const e of mockEvents) {
    const venueId = venueIdBySlug.get(e.venueId);
    if (!venueId) continue;

    const eventDate = parseDate(e.date || e.startDate);

    await Event.create({
      slug: `event-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: e.name || e.title,
      venueId,
      date: eventDate,
      eventType: e.type || e.eventType,
      price: Number(e.price) || 0,
      capacity: e.capacity,
      registeredCount: e.registered || 0,
      description: e.description,
      status: 'published',
      imageUrl: e.image,
    });
  }

  /* ─── Reviews ─────────────────────────────────────────────────── */

  console.log('  Inserting reviews...');
  for (const [venueSlug, reviewData] of Object.entries(mockReviews)) {
    const venueId = venueIdBySlug.get(venueSlug);
    if (!venueId || !reviewData.items?.length) continue;

    for (const item of reviewData.items) {
      await Review.create({
        venueId,
        userId: new mongoose.Types.ObjectId('000000000000000000000001'),
        rating: item.rating || 5,
        text: item.text || '',
        status: 'approved',
      });
    }
  }

  /* ─── Guides / Posts ──────────────────────────────────────────── */

  console.log('  Inserting guides/posts...');
  for (const g of mockGuides) {
    await Post.create({
      slug: g.id || `guide-${Math.random().toString(36).slice(2, 8)}`,
      title: g.title || g.name || 'Untitled Guide',
      subtitle: g.subtitle,
      postType: 'guide',
      status: 'published',
      summary: g.summary || g.description?.slice(0, 300),
      content: g.description || '<p>Guide content pending</p>',
      heroImageUrl: g.image,
      readTime: g.readTime,
      isFeatured: g.isFeatured || false,
    });
  }

  /* ─── Bookings ────────────────────────────────────────────────── */

  console.log('  Inserting bookings...');
  for (const b of mockBookings) {
    const venueId = venueIdBySlug.get(b.venueId);
    if (!venueId) continue;

    await Booking.create({
      userId: new mongoose.Types.ObjectId('000000000000000000000001'),
      venueId,
      bookingType: b.type || 'court',
      date: parseDate(b.date) || b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      playerCount: b.players || 1,
      amount: Number(b.price) || 0,
      status: b.status || 'confirmed',
    });
  }

  console.log('\n✅ Seed complete!');
  console.log(`   Cities:     ${insertedCities.length}`);
  console.log(`   Venues:     ${mockVenues.length}`);
  console.log(`   Coaches:    ${mockCoaches.length}`);
  console.log(`   Sessions:   ${mockSessions.length}`);
  console.log(`   Tournaments:${mockTournaments.length}`);
  console.log(`   Events:     ${mockEvents.length}`);
  console.log(`   Reviews:    ${Object.values(mockReviews).reduce((a: number, r: any) => a + (r.items?.length || 0), 0)}`);
  console.log(`   Guides:     ${mockGuides.length}`);
  console.log(`   Bookings:   ${mockBookings.length}`);

  await mongoose.disconnect();
  process.exit(0);
}

/* ─── Utility Functions ────────────────────────────────────────── */

function convertToTime(str: string): string | null {
  if (!str) return null;
  str = str.trim().toUpperCase();
  const match = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return null;
  let hours = parseInt(match[1]!);
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const meridiem = match[3];

  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function parseDate(str: string): string | null {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]!;
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
