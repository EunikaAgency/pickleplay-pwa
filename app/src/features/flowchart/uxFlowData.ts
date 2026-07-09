/**
 * UX Flowchart data — nodes and edges for the Player and Owner perspectives.
 *
 * LAYOUT RULE: a card's children always sit in the column to its RIGHT, never
 * below it — so every fan-out is a clean left-to-right spread and no arrow
 * ever has to route around a card. Same-column edges only exist between
 * vertically ADJACENT cards (straight short arrows).
 *
 * The authored x only sets column membership (columns are re-pitched evenly at
 * render time) and the authored y only sets the vertical ORDER within a column
 * (cards are auto-stacked from their real rendered heights).
 */

export type Perspective = 'player' | 'owner';

export type NodeType =
  | 'screen'
  | 'tab'
  | 'section'
  | 'action'
  | 'modal'
  | 'drawer'
  | 'form'
  | 'details'
  | 'summary'
  | 'confirmation';

export interface FlowNode {
  id: string;
  perspective: Perspective;
  title: string;
  type: NodeType;
  module: string;
  description: string;
  next?: string;
  x: number;
  y: number;
}

export interface FlowEdge {
  id: string;
  perspective: Perspective;
  from: string;
  to: string;
  label: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLAYER NODES
// ═══════════════════════════════════════════════════════════════════════════════

const PLAYER_NODES: FlowNode[] = [
  // ── Auth ─────────────────────────────────────────────────────────────────
  {
    id: 'p-splash',
    perspective: 'player',
    title: 'Splash Screen',
    type: 'screen',
    module: 'Auth',
    description: 'Animated launch intro with serve and brand reveal. Once per session.',
    x: 40, y: 40,
  },
  {
    id: 'p-landing',
    perspective: 'player',
    title: 'Landing Page',
    type: 'screen',
    module: 'Auth',
    description: 'Marketing welcome: skill-matched games, local players, court directory.',
    x: 40, y: 180,
  },
  {
    id: 'p-login',
    perspective: 'player',
    title: 'Login / Register',
    type: 'screen',
    module: 'Auth',
    description: 'Sign in with email, or register as Player or Owner. Test accounts available.',
    x: 40, y: 320,
  },
  {
    id: 'p-onboarding',
    perspective: 'player',
    title: 'Onboarding',
    type: 'screen',
    module: 'Auth',
    description: 'First-time setup: pick skill tier, set home court. Can be skipped.',
    x: 40, y: 460,
  },

  // ── Home hub ─────────────────────────────────────────────────────────────
  {
    id: 'p-home',
    perspective: 'player',
    title: 'Player Home',
    type: 'screen',
    module: 'Home',
    description: 'Next commitment hero (game or booking), open games near you, courts to book, check-in hotspot.',
    x: 340, y: 40,
  },

  // ── Home sections (to the right of Home) ─────────────────────────────────
  {
    id: 'p-home-commitment',
    perspective: 'player',
    title: 'Next Commitment Hero',
    type: 'section',
    module: 'Home',
    description: 'Soonest game or booking. Tap to view details or navigate to My Bookings.',
    x: 640, y: 40,
  },
  {
    id: 'p-home-open-games',
    perspective: 'player',
    title: 'Open Games Near You',
    type: 'section',
    module: 'Home',
    description: 'Horizontal scroll of published games. Tap a card to open game details.',
    x: 640, y: 180,
  },
  {
    id: 'p-home-courts',
    perspective: 'player',
    title: 'Courts to Book',
    type: 'section',
    module: 'Home',
    description: 'Venue cards ranked by distance. Tap to open court details.',
    x: 640, y: 320,
  },
  {
    id: 'p-create-choice',
    perspective: 'player',
    title: 'Game On Chooser',
    type: 'modal',
    module: 'Games',
    description: 'Bottom sheet: Join a game (browse) or Host a lobby (pick booked court or book one).',
    x: 640, y: 460,
  },

  // ── Map / Nearby hub ─────────────────────────────────────────────────────
  {
    id: 'p-nearby',
    perspective: 'player',
    title: 'Map / Nearby',
    type: 'screen',
    module: 'Venues',
    description: 'Interactive map with venue pins and scrollable list. Filter by court type, price, amenities. Locate me.',
    x: 940, y: 40,
  },

  // ── Venue detail (right of Nearby) ───────────────────────────────────────
  {
    id: 'p-court-detail',
    perspective: 'player',
    title: 'Court / Venue Detail',
    type: 'details',
    module: 'Venues',
    description: 'Hero, ratings, distance. Open today hours, photos, court list, games here, map, contact. Book CTA.',
    x: 990, y: 40,
  },
  {
    id: 'p-nearby-filter',
    perspective: 'player',
    title: 'Nearby Filter Sheet',
    type: 'drawer',
    module: 'Venues',
    description: 'Bottom sheet: court type, price range, open play, distance radius, amenities.',
    x: 990, y: 180,
  },

  // ── Venue actions + Booking Step 1 (right of Venue Detail) ───────────────
  {
    id: 'p-book-court',
    perspective: 'player',
    title: 'Book a Court — Step 1',
    type: 'form',
    module: 'Bookings',
    description: 'Fields: venue, date, court, full- or half-court, number of players, start & end time. Booked hours are greyed out.',
    x: 1020, y: 40,
  },
  {
    id: 'p-choose-type',
    perspective: 'player',
    title: 'Choose Booking Type',
    type: 'action',
    module: 'Bookings',
    description: 'Pick how the court will be used: Public game (joinable lobby), Open play (interest board), or Private game (just your group).',
    x: 1020, y: 200,
  },
  {
    id: 'p-membership-sheet',
    perspective: 'player',
    title: 'Join Membership',
    type: 'modal',
    module: 'Venues',
    description: 'Bottom sheet: subscription plans (monthly/quarterly/annual). Join, switch, or renew.',
    x: 1020, y: 360,
  },
  {
    id: 'p-open-play-book',
    perspective: 'player',
    title: 'Book Open Play',
    type: 'form',
    module: 'Bookings',
    description: 'Courtless drop-in: date, time, party size. Priced at venue open-play rate.',
    x: 1020, y: 500,
  },

  // ── Booking type split (right of Choose Booking Type) ────────────────────
  {
    id: 'p-book-public',
    perspective: 'player',
    title: 'Public Game Details',
    type: 'form',
    module: 'Bookings',
    description: 'Fields: game format (Bracketing / Round-robin / Mini-tournament), player slots (2–16), game name (optional), description (optional). Publishes a joinable lobby with the booking.',
    x: 1240, y: 40,
  },
  {
    id: 'p-book-openplay',
    perspective: 'player',
    title: 'Open Play Details',
    type: 'form',
    module: 'Bookings',
    description: 'Fields: skill level (Beginner / 2.5–3.0 / 3.0–3.5 / 3.5–4.0 / 4.0+ / Open), game name (optional), description (optional). Posts an interest-board session with the booking.',
    x: 1240, y: 200,
  },
  {
    id: 'p-book-private',
    perspective: 'player',
    title: 'Private Game',
    type: 'action',
    module: 'Bookings',
    description: 'No extra details step — the court is booked just for you. Goes straight to Review & Pay.',
    x: 1240, y: 360,
  },

  // ── Review → Checkout → Confirmation chain ───────────────────────────────
  {
    id: 'p-book-review',
    perspective: 'player',
    title: 'Review & Pay',
    type: 'summary',
    module: 'Bookings',
    description: 'Booking summary with total. Add-on: equipment rental. Payment options: Pay in full, Deposit, or Pay at venue.',
    x: 1330, y: 40,
  },
  {
    id: 'p-book-checkout',
    perspective: 'player',
    title: 'Checkout',
    type: 'form',
    module: 'Bookings',
    description: 'Card payment form: card number, expiry (MM/YY), CVC. At approval-required venues this becomes "Request booking" — card saved, no charge yet.',
    x: 1330, y: 180,
  },
  {
    id: 'p-book-confirmation',
    perspective: 'player',
    title: 'Booking Confirmation',
    type: 'confirmation',
    module: 'Bookings',
    description: 'Court reserved (or request submitted for approval). Links to the created game and to My Bookings.',
    x: 1330, y: 320,
  },
  {
    id: 'p-my-bookings',
    perspective: 'player',
    title: 'My Bookings',
    type: 'screen',
    module: 'Bookings',
    description: 'Court bookings list with status chips. Pay awaiting-payment bookings. Cancel bookings.',
    x: 1330, y: 460,
  },
  {
    id: 'p-booking-refund',
    perspective: 'player',
    title: 'Cancel / Refund Booking',
    type: 'screen',
    module: 'Bookings',
    description: 'Booking summary with cancel & refund request. Used after lobby delete.',
    x: 1330, y: 600,
  },

  // ── Games hub ────────────────────────────────────────────────────────────
  {
    id: 'p-games',
    perspective: 'player',
    title: 'Games Tab',
    type: 'screen',
    module: 'Games',
    description: 'Two sections: Booking (calendar↔list) and Games (Browse / My Games). Filter chips.',
    x: 1420, y: 40,
  },

  // ── Games lists (right of Games Tab) ─────────────────────────────────────
  {
    id: 'p-games-browse',
    perspective: 'player',
    title: 'Browse Games',
    type: 'tab',
    module: 'Games',
    description: 'Public published games grouped by date. Card: time, venue, skill, spots. Tap for detail.',
    x: 1500, y: 40,
  },
  {
    id: 'p-games-mine',
    perspective: 'player',
    title: 'My Games',
    type: 'tab',
    module: 'Games',
    description: 'Games you host or joined. Status accent cards. Tap to manage or view.',
    x: 1500, y: 180,
  },
  {
    id: 'p-create-game',
    perspective: 'player',
    title: 'Create / Host Lobby',
    type: 'screen',
    module: 'Games',
    description: '4-step: Format → Slots → Details → Review. Venue/date locked from booking.',
    x: 1500, y: 320,
  },

  // ── Game detail screens (right of the lists) ─────────────────────────────
  {
    id: 'p-game-detail',
    perspective: 'player',
    title: 'Game Details / Lobby',
    type: 'details',
    module: 'Games',
    description: 'Hero, roster, join/leave. Host: edit, delete, share. Chat button. Grace period logic.',
    x: 1580, y: 40,
  },
  {
    id: 'p-game-chat',
    perspective: 'player',
    title: 'Game Chat',
    type: 'screen',
    module: 'Games',
    description: 'Real-time group chat for the roster. Messenger-style. Live via SSE.',
    x: 1580, y: 180,
  },
  {
    id: 'p-open-play',
    perspective: 'player',
    title: 'Open Play Detail',
    type: 'details',
    module: 'Games',
    description: 'Interest board (no lobby). Toggle "I\'m Interested". Shows who\'s interested.',
    x: 1580, y: 320,
  },

  // ── Clubs hub ────────────────────────────────────────────────────────────
  {
    id: 'p-clubs',
    perspective: 'player',
    title: 'Clubs Tab',
    type: 'screen',
    module: 'Clubs',
    description: 'My Clubs + Discover directory. Server-side search. Create club button.',
    x: 1780, y: 40,
  },
  {
    id: 'p-club-detail',
    perspective: 'player',
    title: 'Club Detail',
    type: 'details',
    module: 'Clubs',
    description: 'Tabs: Feed (posts, likes, photos), About (info, members), Chat. Join/leave. Host tools.',
    x: 1860, y: 40,
  },
  {
    id: 'p-create-club',
    perspective: 'player',
    title: 'Create a Club',
    type: 'screen',
    module: 'Clubs',
    description: '3-step: name & description, cover photo & member limit, review & create.',
    x: 1860, y: 180,
  },
  {
    id: 'p-club-post',
    perspective: 'player',
    title: 'Club Post Permalink',
    type: 'details',
    module: 'Clubs',
    description: 'Single post with all comments and composer. Like, reply, edit, delete.',
    x: 1940, y: 40,
  },
  {
    id: 'p-club-chat',
    perspective: 'player',
    title: 'Club Chat',
    type: 'screen',
    module: 'Clubs',
    description: 'Real-time member group chat separate from the feed.',
    x: 1940, y: 180,
  },
  {
    id: 'p-edit-club',
    perspective: 'player',
    title: 'Edit Club',
    type: 'form',
    module: 'Clubs',
    description: 'Host-only: edit name, description, visibility, cover photo, member limit.',
    x: 1940, y: 320,
  },

  // ── Tournaments (simple vertical chain) ──────────────────────────────────
  {
    id: 'p-tournaments',
    perspective: 'player',
    title: 'Tournaments Tab',
    type: 'screen',
    module: 'Tournaments',
    description: 'Role-aware tabs: Open (register), Joined/Managing, Results. Tournament cards.',
    x: 2140, y: 40,
  },
  {
    id: 'p-tournament-detail',
    perspective: 'player',
    title: 'Tournament Detail',
    type: 'details',
    module: 'Tournaments',
    description: 'Banner, info, register/withdraw, capacity bar. Chat for participants.',
    x: 2140, y: 180,
  },
  {
    id: 'p-tournament-chat',
    perspective: 'player',
    title: 'Tournament Chat',
    type: 'screen',
    module: 'Tournaments',
    description: 'Participant group chat. Roster: organizer + registrants. Live via SSE.',
    x: 2140, y: 320,
  },

  // ── Profile hub ──────────────────────────────────────────────────────────
  {
    id: 'p-profile',
    perspective: 'player',
    title: 'Player Profile',
    type: 'screen',
    module: 'Profile',
    description: 'Avatar, stats, recent games. Links: Edit Profile, Settings, Messages, Notifications, Payments.',
    x: 2500, y: 40,
  },
  {
    id: 'p-search',
    perspective: 'player',
    title: 'Search',
    type: 'screen',
    module: 'Search',
    description: 'Global search: courts, games, clubs, players. Recent searches saved.',
    x: 2500, y: 180,
  },

  // ── Account screens (right of Profile) ───────────────────────────────────
  {
    id: 'p-edit-profile',
    perspective: 'player',
    title: 'Edit Profile',
    type: 'form',
    module: 'Profile',
    description: 'Edit avatar (crop), display name, bio, skill tier (players only).',
    x: 2580, y: 40,
  },
  {
    id: 'p-settings',
    perspective: 'player',
    title: 'Settings',
    type: 'screen',
    module: 'Profile',
    description: 'Appearance, notification toggles, distance units, search radius, privacy.',
    x: 2580, y: 180,
  },
  {
    id: 'p-notifications',
    perspective: 'player',
    title: 'Notifications',
    type: 'screen',
    module: 'Profile',
    description: 'Inbox with filters. Deep links. Push enable. Mark all read.',
    x: 2580, y: 320,
  },
  {
    id: 'p-messages',
    perspective: 'player',
    title: 'Messages',
    type: 'screen',
    module: 'Messages',
    description: 'Conversation threads. New message: search any player.',
    x: 2580, y: 460,
  },
  {
    id: 'p-payment-history',
    perspective: 'player',
    title: 'Payment History',
    type: 'screen',
    module: 'Payments',
    description: 'Spend KPIs, 6-month bar chart, receipt list with popup detail.',
    x: 2580, y: 600,
  },
  {
    id: 'p-chat',
    perspective: 'player',
    title: 'Chat (Direct Message)',
    type: 'screen',
    module: 'Messages',
    description: '1-on-1 chat, real-time SSE. Reply, unsend, forward. From Messages, game host, or notification.',
    x: 2660, y: 40,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PLAYER EDGES
// ═══════════════════════════════════════════════════════════════════════════════

const PLAYER_EDGES: FlowEdge[] = [
  // Entry flow
  { id: 'pe-splash-landing', perspective: 'player', from: 'p-splash', to: 'p-landing', label: 'Tap "Let\'s Play"' },
  { id: 'pe-landing-login', perspective: 'player', from: 'p-landing', to: 'p-login', label: 'Get Started or Sign In' },
  { id: 'pe-login-onboarding', perspective: 'player', from: 'p-login', to: 'p-onboarding', label: 'New user' },
  { id: 'pe-login-home', perspective: 'player', from: 'p-login', to: 'p-home', label: 'Returning user' },
  { id: 'pe-onboarding-home', perspective: 'player', from: 'p-onboarding', to: 'p-home', label: 'Complete onboarding' },

  // Home → its sections (clean rightward fan)
  { id: 'pe-home-commitment', perspective: 'player', from: 'p-home', to: 'p-home-commitment', label: 'Next commitment' },
  { id: 'pe-home-open-games', perspective: 'player', from: 'p-home', to: 'p-home-open-games', label: 'Browse open games' },
  { id: 'pe-home-courts', perspective: 'player', from: 'p-home', to: 'p-home-courts', label: 'Browse courts' },
  { id: 'pe-home-create', perspective: 'player', from: 'p-home', to: 'p-create-choice', label: 'Tap "Create match"' },

  // Section destinations
  { id: 'pe-commitment-game', perspective: 'player', from: 'p-home-commitment', to: 'p-game-detail', label: 'View game' },
  { id: 'pe-commitment-booking', perspective: 'player', from: 'p-home-commitment', to: 'p-my-bookings', label: 'View booking' },
  { id: 'pe-open-games-detail', perspective: 'player', from: 'p-home-open-games', to: 'p-game-detail', label: 'Tap a game' },
  { id: 'pe-courts-detail', perspective: 'player', from: 'p-home-courts', to: 'p-court-detail', label: 'Tap a venue card' },

  // Create choice
  { id: 'pe-choice-join', perspective: 'player', from: 'p-create-choice', to: 'p-games-browse', label: 'Join a game' },
  { id: 'pe-choice-host', perspective: 'player', from: 'p-create-choice', to: 'p-create-game', label: 'Host a lobby' },
  { id: 'pe-choice-book', perspective: 'player', from: 'p-create-choice', to: 'p-nearby', label: 'No booking → book first' },

  // Nearby → detail + filter (rightward fan)
  { id: 'pe-nearby-court', perspective: 'player', from: 'p-nearby', to: 'p-court-detail', label: 'Tap venue pin or card' },
  { id: 'pe-nearby-filter', perspective: 'player', from: 'p-nearby', to: 'p-nearby-filter', label: 'Tap filter' },

  // Court detail → actions (rightward fan)
  { id: 'pe-court-book', perspective: 'player', from: 'p-court-detail', to: 'p-book-court', label: 'Book this court' },
  { id: 'pe-court-membership', perspective: 'player', from: 'p-court-detail', to: 'p-membership-sheet', label: 'Join Membership' },
  { id: 'pe-court-openplay', perspective: 'player', from: 'p-court-detail', to: 'p-open-play-book', label: 'Join open play' },

  // Booking flow — splits by booking type, then converges on Review & Pay
  { id: 'pe-book-choose', perspective: 'player', from: 'p-book-court', to: 'p-choose-type', label: 'Continue' },
  { id: 'pe-book-public', perspective: 'player', from: 'p-choose-type', to: 'p-book-public', label: 'Public game' },
  { id: 'pe-book-open', perspective: 'player', from: 'p-choose-type', to: 'p-book-openplay', label: 'Open play' },
  { id: 'pe-book-private', perspective: 'player', from: 'p-choose-type', to: 'p-book-private', label: 'Private game' },
  { id: 'pe-public-review', perspective: 'player', from: 'p-book-public', to: 'p-book-review', label: 'Continue' },
  { id: 'pe-open-review', perspective: 'player', from: 'p-book-openplay', to: 'p-book-review', label: 'Continue' },
  { id: 'pe-private-review', perspective: 'player', from: 'p-book-private', to: 'p-book-review', label: 'Continue' },
  { id: 'pe-review-checkout', perspective: 'player', from: 'p-book-review', to: 'p-book-checkout', label: 'Choose payment option' },
  { id: 'pe-checkout-confirm', perspective: 'player', from: 'p-book-checkout', to: 'p-book-confirmation', label: 'Pay / Request booking' },
  { id: 'pe-confirm-public', perspective: 'player', from: 'p-book-confirmation', to: 'p-game-detail', label: 'View public game' },
  { id: 'pe-confirm-open', perspective: 'player', from: 'p-book-confirmation', to: 'p-open-play', label: 'View open play' },
  { id: 'pe-confirm-bookings', perspective: 'player', from: 'p-book-confirmation', to: 'p-my-bookings', label: 'View my bookings' },
  { id: 'pe-bookings-refund', perspective: 'player', from: 'p-my-bookings', to: 'p-booking-refund', label: 'Cancel a booking' },

  // Games tab → lists → detail (rightward fans)
  { id: 'pe-games-browse', perspective: 'player', from: 'p-games', to: 'p-games-browse', label: 'Browse tab' },
  { id: 'pe-games-mine', perspective: 'player', from: 'p-games', to: 'p-games-mine', label: 'My Games tab' },
  { id: 'pe-browse-detail', perspective: 'player', from: 'p-games-browse', to: 'p-game-detail', label: 'Tap a game card' },
  { id: 'pe-browse-openplay', perspective: 'player', from: 'p-games-browse', to: 'p-open-play', label: 'Tap open play' },
  { id: 'pe-mine-detail', perspective: 'player', from: 'p-games-mine', to: 'p-game-detail', label: 'Tap your game' },
  { id: 'pe-game-chat', perspective: 'player', from: 'p-game-detail', to: 'p-game-chat', label: 'Game Chat' },
  { id: 'pe-game-msg-organizer', perspective: 'player', from: 'p-game-detail', to: 'p-chat', label: 'Message organizer' },

  // Tournaments
  { id: 'pe-tournaments-detail', perspective: 'player', from: 'p-tournaments', to: 'p-tournament-detail', label: 'Tap a tournament' },
  { id: 'pe-tournament-chat', perspective: 'player', from: 'p-tournament-detail', to: 'p-tournament-chat', label: 'Tournament chat' },

  // Clubs (rightward fans)
  { id: 'pe-clubs-detail', perspective: 'player', from: 'p-clubs', to: 'p-club-detail', label: 'Tap a club' },
  { id: 'pe-clubs-create', perspective: 'player', from: 'p-clubs', to: 'p-create-club', label: 'Create a club' },
  { id: 'pe-club-post', perspective: 'player', from: 'p-club-detail', to: 'p-club-post', label: 'Tap a post' },
  { id: 'pe-club-chat', perspective: 'player', from: 'p-club-detail', to: 'p-club-chat', label: 'Club chat' },
  { id: 'pe-club-edit', perspective: 'player', from: 'p-club-detail', to: 'p-edit-club', label: 'Edit club (host)' },

  // Profile → account screens (rightward fan)
  { id: 'pe-profile-edit', perspective: 'player', from: 'p-profile', to: 'p-edit-profile', label: 'Edit Profile' },
  { id: 'pe-profile-settings', perspective: 'player', from: 'p-profile', to: 'p-settings', label: 'Settings' },
  { id: 'pe-profile-notifs', perspective: 'player', from: 'p-profile', to: 'p-notifications', label: 'Notifications' },
  { id: 'pe-profile-messages', perspective: 'player', from: 'p-profile', to: 'p-messages', label: 'Messages' },
  { id: 'pe-profile-payments', perspective: 'player', from: 'p-profile', to: 'p-payment-history', label: 'Payment History' },
  { id: 'pe-messages-chat', perspective: 'player', from: 'p-messages', to: 'p-chat', label: 'Tap a conversation' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// OWNER NODES
// ═══════════════════════════════════════════════════════════════════════════════

const OWNER_NODES: FlowNode[] = [
  // ── Entry ────────────────────────────────────────────────────────────────
  {
    id: 'o-login',
    perspective: 'owner',
    title: 'Login / Register',
    type: 'screen',
    module: 'Auth',
    description: 'Sign in with owner account, or register as Owner. Lands on Owner Dashboard.',
    x: 40, y: 40,
  },

  // ── Dashboard hub ────────────────────────────────────────────────────────
  {
    id: 'o-home',
    perspective: 'owner',
    title: 'Owner Dashboard',
    type: 'screen',
    module: 'Home',
    description: 'Revenue hero + KPIs. Pending approvals (Confirm/Decline). Venue cards. Quick actions: Front Desk, Calendar, Reports, New Venue.',
    x: 340, y: 40,
  },

  // ── Dashboard sections (right of Dashboard) ──────────────────────────────
  {
    id: 'o-pending-approvals',
    perspective: 'owner',
    title: 'Pending Approvals',
    type: 'section',
    module: 'Home',
    description: 'Booking requests needing owner decision. Confirm or Decline inline.',
    x: 640, y: 40,
  },
  {
    id: 'o-home-venues',
    perspective: 'owner',
    title: 'Your Venue Cards',
    type: 'section',
    module: 'Home',
    description: 'Summary cards with image, location, court count, glance stats. Tap to open venue editor.',
    x: 640, y: 180,
  },
  {
    id: 'o-booking-detail-sheet',
    perspective: 'owner',
    title: 'Booking Detail Sheet',
    type: 'modal',
    module: 'Bookings',
    description: 'Full booking info: player, court, date, time, amount. Confirm/Decline/Cancel actions.',
    x: 720, y: 40,
  },

  // ── Venues management hub ────────────────────────────────────────────────
  {
    id: 'o-venues',
    perspective: 'owner',
    title: 'Venues Management',
    type: 'screen',
    module: 'Venues',
    description: 'Courts-first view with venue dropdown. Summary tiles. Court cards. Add court.',
    x: 940, y: 40,
  },
  {
    id: 'o-create-venue',
    perspective: 'owner',
    title: 'Create a Venue',
    type: 'screen',
    module: 'Venues',
    description: 'Name, address autocomplete + map pin, city, contact info. Opens venue editor after creation.',
    x: 1000, y: 40,
  },
  {
    id: 'o-claim-venue',
    perspective: 'owner',
    title: 'Claim a Venue',
    type: 'screen',
    module: 'Venues',
    description: 'Search unclaimed listings. Submit ownership claim: description, links, proof documents.',
    x: 1000, y: 180,
  },

  // ── Venue editor hub ─────────────────────────────────────────────────────
  {
    id: 'o-venue-editor',
    perspective: 'owner',
    title: 'Venue Editor',
    type: 'screen',
    module: 'Venues',
    description: '11 tab pages: Overview, Insights, Bookings, Membership, Listing, Location, Courts, FAQs, Photos, Staff, Demand.',
    x: 1060, y: 40,
  },

  // ── ALL editor tabs (right of the editor, one clean fan) ─────────────────
  {
    id: 'o-tab-overview',
    perspective: 'owner',
    title: 'Overview Tab',
    type: 'tab',
    module: 'Venues',
    description: 'Business dashboard: revenue KPIs, chart, booking link share, completeness meter.',
    x: 1240, y: 40,
  },
  {
    id: 'o-tab-insights',
    perspective: 'owner',
    title: 'Insights Tab',
    type: 'tab',
    module: 'Venues',
    description: 'Segmented analytics: Revenue, Bookings, Usage, Courts, Demand, Leakage. Charts and heatmaps.',
    x: 1240, y: 180,
  },
  {
    id: 'o-tab-bookings',
    perspective: 'owner',
    title: 'Bookings Inbox',
    type: 'tab',
    module: 'Venues',
    description: 'Booking list with status filter. Approve request-to-book, Decline, Cancel.',
    x: 1240, y: 320,
  },
  {
    id: 'o-tab-members',
    perspective: 'owner',
    title: 'Membership Tab',
    type: 'tab',
    module: 'Venues',
    description: 'Member list, add/remove members. Manage Subscription Plans button.',
    x: 1240, y: 460,
  },
  {
    id: 'o-tab-listing',
    perspective: 'owner',
    title: 'Listing Editor',
    type: 'tab',
    module: 'Venues',
    description: 'Name, description, contact. Booking policy (approval toggle, pay window). Custom slug. Amenities.',
    x: 1240, y: 600,
  },
  {
    id: 'o-tab-location',
    perspective: 'owner',
    title: 'Location Editor',
    type: 'tab',
    module: 'Venues',
    description: 'Address autocomplete, map pin, lat/lng, city, postcode. Structured address fields.',
    x: 1240, y: 740,
  },
  {
    id: 'o-tab-courts',
    perspective: 'owner',
    title: 'Courts Editor',
    type: 'tab',
    module: 'Venues',
    description: 'Per-court: name, surface, photos, description, features, hours + pricing grid.',
    x: 1240, y: 880,
  },
  {
    id: 'o-tab-faqs',
    perspective: 'owner',
    title: 'FAQs Editor',
    type: 'tab',
    module: 'Venues',
    description: 'Add, edit, delete FAQ entries for the venue listing page.',
    x: 1240, y: 1020,
  },
  {
    id: 'o-tab-photos',
    perspective: 'owner',
    title: 'Photos Tab',
    type: 'tab',
    module: 'Venues',
    description: 'Upload and manage venue gallery photos.',
    x: 1240, y: 1160,
  },
  {
    id: 'o-tab-staff',
    perspective: 'owner',
    title: 'Staff Tab',
    type: 'tab',
    module: 'Venues',
    description: 'Assign staff to this venue. Staff can manage bookings but not edit structure.',
    x: 1240, y: 1300,
  },
  {
    id: 'o-tab-demand',
    perspective: 'owner',
    title: 'Demand Analytics Tab',
    type: 'tab',
    module: 'Venues',
    description: '9-signal summary, conversion rate, demand-by-hour heatmap, supply/occupancy, pricing suggestions.',
    x: 1240, y: 1440,
  },

  // ── Subscription plans (right of Membership tab) ─────────────────────────
  {
    id: 'o-subscription-plans',
    perspective: 'owner',
    title: 'Subscription Plans',
    type: 'screen',
    module: 'Venues',
    description: 'Plan list with CRUD. Edit, Duplicate, Enable/Disable, Delete. Create via bottom sheet form.',
    x: 1330, y: 40,
  },

  // ── Operations screens ───────────────────────────────────────────────────
  {
    id: 'o-front-desk',
    perspective: 'owner',
    title: 'Front Desk',
    type: 'screen',
    module: 'Bookings',
    description: 'Venue picker, today\'s schedule, pending approvals. Add walk-in/phone booking. Block slot.',
    x: 1780, y: 40,
  },
  {
    id: 'o-calendar',
    perspective: 'owner',
    title: 'Owner Calendar',
    type: 'screen',
    module: 'Schedule',
    description: 'Court-by-court 14-day hourly grid. Filter by booking type. Summary metrics.',
    x: 1780, y: 180,
  },
  {
    id: 'o-pricing',
    perspective: 'owner',
    title: 'Pricing Rules',
    type: 'screen',
    module: 'Pricing',
    description: 'Paint grid: assign pricing rules or Reserved/Maintenance to day×hour cells. Rules CRUD.',
    x: 1780, y: 320,
  },
  {
    id: 'o-reports',
    perspective: 'owner',
    title: 'Reports & Analytics',
    type: 'screen',
    module: 'Bookings',
    description: 'Date/venue/status filters. 8 KPIs, trend chart, revenue bars, donut, venue matrix, activity feed. CSV/PDF export.',
    x: 1780, y: 460,
  },
  {
    id: 'o-insights',
    perspective: 'owner',
    title: 'All-Venues Insights',
    type: 'screen',
    module: 'Analytics',
    description: 'Combined analytics across all venues with segmented sections and per-venue comparison.',
    x: 1780, y: 600,
  },
  {
    id: 'o-games',
    perspective: 'owner',
    title: 'Owner Games',
    type: 'screen',
    module: 'Games',
    description: '"Your courts" schedule + lobbies list. Bookings and games at your venues by day.',
    x: 1780, y: 740,
  },
  {
    id: 'o-nearby',
    perspective: 'owner',
    title: 'Owner Map',
    type: 'screen',
    module: 'Venues',
    description: 'Operations map with live-status pins. Attention-sorted venue list. Pricing button.',
    x: 1780, y: 880,
  },

  // ── Profile hub ──────────────────────────────────────────────────────────
  {
    id: 'o-profile',
    perspective: 'owner',
    title: 'Owner Profile',
    type: 'screen',
    module: 'Profile',
    description: 'Avatar, name, venue stats. My venues, Calendar, Reports, Staff, New venue, Edit Profile, Notifications, Settings.',
    x: 2140, y: 40,
  },

  // ── Profile children (right of Profile) ──────────────────────────────────
  {
    id: 'o-staff',
    perspective: 'owner',
    title: 'Staff Management',
    type: 'screen',
    module: 'Staff',
    description: 'Create staff accounts with login. List, reset passwords, remove staff.',
    x: 2220, y: 40,
  },
  {
    id: 'o-settlements',
    perspective: 'owner',
    title: 'Settlements',
    type: 'screen',
    module: 'Payments',
    description: 'Unsettled balance, payout methods (add/remove), settlement history.',
    x: 2220, y: 180,
  },
  {
    id: 'o-admin-claims',
    perspective: 'owner',
    title: 'Venue Claims (Admin)',
    type: 'screen',
    module: 'Admin',
    description: 'Review submitted claims: approve, reject, or request more info.',
    x: 2220, y: 320,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// OWNER EDGES
// ═══════════════════════════════════════════════════════════════════════════════

const OWNER_EDGES: FlowEdge[] = [
  // Entry
  { id: 'oe-login-home', perspective: 'owner', from: 'o-login', to: 'o-home', label: 'Sign in as Owner' },

  // Dashboard → sections (rightward fan)
  { id: 'oe-home-pending', perspective: 'owner', from: 'o-home', to: 'o-pending-approvals', label: 'Pending approvals' },
  { id: 'oe-home-venues', perspective: 'owner', from: 'o-home', to: 'o-home-venues', label: 'Your venues' },
  { id: 'oe-pending-sheet', perspective: 'owner', from: 'o-pending-approvals', to: 'o-booking-detail-sheet', label: 'Tap a booking row' },
  { id: 'oe-venue-card-editor', perspective: 'owner', from: 'o-home-venues', to: 'o-venue-editor', label: 'Tap a venue card' },

  // Quick actions (long hops → connector points)
  { id: 'oe-home-front-desk', perspective: 'owner', from: 'o-home', to: 'o-front-desk', label: 'Front desk' },
  { id: 'oe-home-calendar', perspective: 'owner', from: 'o-home', to: 'o-calendar', label: 'Calendar' },
  { id: 'oe-home-reports', perspective: 'owner', from: 'o-home', to: 'o-reports', label: 'Reports' },
  { id: 'oe-home-new-venue', perspective: 'owner', from: 'o-home', to: 'o-create-venue', label: 'New venue' },
  { id: 'oe-home-insights', perspective: 'owner', from: 'o-home', to: 'o-insights', label: 'Insights' },
  { id: 'oe-home-nearby', perspective: 'owner', from: 'o-home', to: 'o-nearby', label: 'Nearby map' },
  { id: 'oe-home-profile', perspective: 'owner', from: 'o-home', to: 'o-profile', label: 'Profile tab' },

  // Venues management → create/claim (rightward fan) → editor
  { id: 'oe-venues-create', perspective: 'owner', from: 'o-venues', to: 'o-create-venue', label: 'Create venue' },
  { id: 'oe-venues-claim', perspective: 'owner', from: 'o-venues', to: 'o-claim-venue', label: 'Claim venue' },
  { id: 'oe-venues-editor', perspective: 'owner', from: 'o-venues', to: 'o-venue-editor', label: 'Select a venue' },
  { id: 'oe-create-editor', perspective: 'owner', from: 'o-create-venue', to: 'o-venue-editor', label: 'Venue created' },

  // Venue editor → all 11 tabs (one clean rightward fan)
  { id: 'oe-editor-overview', perspective: 'owner', from: 'o-venue-editor', to: 'o-tab-overview', label: 'Overview' },
  { id: 'oe-editor-insights', perspective: 'owner', from: 'o-venue-editor', to: 'o-tab-insights', label: 'Insights' },
  { id: 'oe-editor-bookings', perspective: 'owner', from: 'o-venue-editor', to: 'o-tab-bookings', label: 'Bookings' },
  { id: 'oe-editor-members', perspective: 'owner', from: 'o-venue-editor', to: 'o-tab-members', label: 'Membership' },
  { id: 'oe-editor-listing', perspective: 'owner', from: 'o-venue-editor', to: 'o-tab-listing', label: 'Listing' },
  { id: 'oe-editor-location', perspective: 'owner', from: 'o-venue-editor', to: 'o-tab-location', label: 'Location' },
  { id: 'oe-editor-courts', perspective: 'owner', from: 'o-venue-editor', to: 'o-tab-courts', label: 'Courts' },
  { id: 'oe-editor-faqs', perspective: 'owner', from: 'o-venue-editor', to: 'o-tab-faqs', label: 'FAQs' },
  { id: 'oe-editor-photos', perspective: 'owner', from: 'o-venue-editor', to: 'o-tab-photos', label: 'Photos' },
  { id: 'oe-editor-staff', perspective: 'owner', from: 'o-venue-editor', to: 'o-tab-staff', label: 'Staff' },
  { id: 'oe-editor-demand', perspective: 'owner', from: 'o-venue-editor', to: 'o-tab-demand', label: 'Demand' },

  // Members → plans
  { id: 'oe-members-plans', perspective: 'owner', from: 'o-tab-members', to: 'o-subscription-plans', label: 'Manage Subscription' },

  // Profile → children (rightward fan) + long hops
  { id: 'oe-profile-venues', perspective: 'owner', from: 'o-profile', to: 'o-venues', label: 'My venues' },
  { id: 'oe-profile-staff', perspective: 'owner', from: 'o-profile', to: 'o-staff', label: 'Staff' },
  { id: 'oe-profile-settlements', perspective: 'owner', from: 'o-profile', to: 'o-settlements', label: 'Settlements' },
  { id: 'oe-profile-claims', perspective: 'owner', from: 'o-profile', to: 'o-admin-claims', label: 'Venue claims' },
  { id: 'oe-profile-games', perspective: 'owner', from: 'o-profile', to: 'o-games', label: 'Games' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOW_DATA: Record<Perspective, { nodes: FlowNode[]; edges: FlowEdge[] }> = {
  player: { nodes: PLAYER_NODES, edges: PLAYER_EDGES },
  owner: { nodes: OWNER_NODES, edges: OWNER_EDGES },
};
