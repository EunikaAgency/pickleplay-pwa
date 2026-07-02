(function () {
  'use strict';

  const STORAGE_KEY = 'pickleball-ux-flowchart-v2';
  const VIEWPORT_STORAGE_KEY = 'pickleball-ux-flowchart-viewport';
  const NODE_W = 230;
  const NODE_MIN_H = 62;
  const CANVAS_W_MIN = 3100;
  const CANVAS_H = 2800;
  const VIEWPORT_PADDING = 32;
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 3.0;
  const ZOOM_STEP = 0.1;

  const TYPE_ICONS = {
    screen: '🖥️',
    decision: '🔀',
    action: '⚡',
    success: '✅',
    entry: '🚪',
    group: '📂',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // NODES — Complete PWA screen inventory (75 nodes)
  // Organized by role & functional area. Each node: id, type, label, subtitle?, x, y
  //
  // Layout grid (x-offsets by lane):
  //   Auth ………………… x ≈  940
  //   Player Home …… x ≈  300
  //   Player Nearby … x ≈   40
  //   Player Games …  x ≈  580
  //   Player Clubs …  x ≈  860
  //   Player Profile  x ≈ 1140
  //   Player Social … x ≈ 1420
  //   Owner Dash ……  x ≈ 1720
  //   Owner Ops ……   x ≈ 2020
  //   Organizer ……   x ≈ 2320
  //   Admin ………       x ≈ 2640
  // ═══════════════════════════════════════════════════════════════════════════

  const DEFAULT_NODES = [
    // ── AUTH FLOW (top center) ──────────────────────────────────────────────
    { id:'splash',        type:'entry',   label:'Splash Screen',           subtitle:'Animated intro;\nonce per browser session',              x:940,  y:20 },
    { id:'landing',       type:'screen',  label:'Landing / Welcome',       subtitle:'Marketing surface;\ncold-start entry point',               x:940,  y:130 },
    { id:'login',         type:'screen',  label:'Login / Sign Up',         subtitle:'Email + password;\ntoken-based auth via API',              x:940,  y:250 },
    { id:'forgot-pw',     type:'screen',  label:'Forgot Password',         subtitle:'Enter email → reset link',                                 x:720,  y:250 },
    { id:'reset-pw',      type:'screen',  label:'Reset Password',          subtitle:'Deep-link from email;\ntoken param in URL',                x:720,  y:360 },
    { id:'onboarding',    type:'screen',  label:'Onboarding',              subtitle:'First-time only: pick\nskill tier + preferences',          x:940,  y:370 },
    { id:'guest-browse',  type:'decision',label:'Guest Browsing',          subtitle:'Browse all tabs freely;\nauth-prompt gates commit actions', x:1160, y:180 },
    { id:'role-split',    type:'decision',label:'Role Gate',               subtitle:'isOwner → Owner Dashboard\nelse → Player Home v2.1',       x:940,  y:500 },

    // ── PLAYER v2.1 HOME ───────────────────────────────────────────────────
    { id:'player-home',   type:'screen',  label:'Player Home v2.1',        subtitle:'Commitment hero (game/booking),\nopen games, courts to book', x:200, y:620 },
    { id:'game-on',       type:'decision',label:'"Game On" Chooser',       subtitle:'BottomSheet:\nJoin a game → Browse\nHost a lobby → pick booking', x:200, y:750 },
    { id:'search',        type:'screen',  label:'Global Search',           subtitle:'Courts, games, clubs, players;\ndebounced + recent history',   x:40,  y:880 },

    // ── PLAYER — NEARBY / VENUES ───────────────────────────────────────────
    { id:'nearby',        type:'screen',  label:'Nearby / Map Tab (v2.1)', subtitle:'Venue list + Leaflet map;\nfilters, Near Me, distance',      x:40,  y:750 },
    { id:'court-details', type:'screen',  label:'Court Details',           subtitle:'Photos, hours, pricing,\n"Games here", Book CTA',           x:40,  y:880 },
    { id:'book-court',    type:'action',  label:'Book a Court',            subtitle:'Pick venue → court →\ndate/time → review → checkout',       x:40,  y:1010 },
    { id:'checkout',      type:'screen',  label:'Payment / Checkout',      subtitle:'Card form; test-mode banner;\n7% service fee',                x:-120, y:1140 },
    { id:'bk-confirmed',  type:'success', label:'Booking Confirmed',       subtitle:'Or "Awaiting Approval" if\nrequireBookingApproval is on',     x:-120, y:1270 },
    { id:'my-bookings',   type:'screen',  label:'My Bookings',             subtitle:'List + cancel; pay pending\napprovals from here',             x:200, y:1140 },
    { id:'booking-refund',type:'screen',  label:'Refund / Cancel Booking', subtitle:'After host deletes lobby\nbut keeps court reserved',          x:360, y:1140 },
    { id:'open-play-book',type:'action',  label:'Book Open Play (V3)',     subtitle:'Courtless drop-in session;\ndate+time+party → checkout',      x:360, y:1010 },
    { id:'membership',    type:'action',  label:'Join Membership',         subtitle:'Subscription plan picker\n(via MembershipSheet)',             x:200, y:880 },

    // ── PLAYER — GAMES ─────────────────────────────────────────────────────
    { id:'games-browse',  type:'screen',  label:'Games — Browse (v2.1)',   subtitle:'Published games, date-grouped;\nfilters: when/skill/type',      x:420, y:750 },
    { id:'game-details',  type:'screen',  label:'Game Details',            subtitle:'Roster, spots, skill, venue;\nJoin / Leave / Share / Chat',    x:420, y:880 },
    { id:'game-chat',     type:'screen',  label:'Game Chat',               subtitle:'Per-game group chat;\nrealtime via SSE',                      x:280, y:1270 },
    { id:'invite-players',type:'screen',  label:'Invite Players',          subtitle:'Share deep link or\nsearch + invite to game',                  x:560, y:1270 },
    { id:'create-game-v2',type:'action',  label:'Host a Lobby (v2)',       subtitle:'Pick a booking → locks\nvenue/date/time; set type/spots',     x:560, y:1010 },
    { id:'my-games',      type:'screen',  label:'My Games',                subtitle:'Games created or joined;\nHosting / Going status',             x:420, y:1140 },
    { id:'edit-game',     type:'screen',  label:'Manage Game (Edit)',      subtitle:'Edit details, kick players;\nvenue + schedule read-only',      x:560, y:1140 },

    // ── PLAYER — TOURNAMENTS ───────────────────────────────────────────────
    { id:'tournaments',   type:'screen',  label:'Tournaments Tab (v2.1)',  subtitle:'Role-aware tabs:\nOpen · Joined/Managing · Results',           x:620, y:750 },
    { id:'tourn-detail',  type:'screen',  label:'Tournament Detail',       subtitle:'Overview, register/withdraw,\nannouncements, chat entry',       x:620, y:880 },
    { id:'tourn-chat',    type:'screen',  label:'Tournament Chat',         subtitle:'Participant group chat;\norganizer + registrants',             x:620, y:1010 },

    // ── PLAYER — CLUBS ─────────────────────────────────────────────────────
    { id:'clubs',         type:'screen',  label:'Clubs Tab (v2.1)',        subtitle:'My Clubs + Discover;\nserver-search, paginated',              x:820, y:750 },
    { id:'club-details',  type:'screen',  label:'Club Details',            subtitle:'Feed (posts/likes/comments),\nMembers, About; SSE live',       x:820, y:880 },
    { id:'club-post',     type:'screen',  label:'Club Post (permalink)',   subtitle:'Single post + all comments\n+ composer',                       x:680, y:1010 },
    { id:'club-post-edit',type:'screen',  label:'Edit Club Post',          subtitle:'Author-only dedicated\nedit page',                             x:680, y:1140 },
    { id:'club-chat',     type:'screen',  label:'Club Chat',               subtitle:'Member group chat;\nrealtime via SSE',                         x:960, y:1010 },
    { id:'create-club',   type:'action',  label:'Create Club (v2.1)',      subtitle:'Name, description, visibility,\ncover photo, member limit',    x:960, y:880 },
    { id:'edit-club',     type:'screen',  label:'Edit Club',               subtitle:'Host-only: name, description,\nvisibility, cover photo',       x:960, y:1140 },

    // ── PLAYER — PROFILE + SOCIAL ──────────────────────────────────────────
    { id:'profile',       type:'screen',  label:'Profile / You Tab (v2.1)',subtitle:'Stats, recent games, links;\nowner/org/admin rows if role',     x:1040, y:750 },
    { id:'edit-profile',  type:'screen',  label:'Edit Profile',            subtitle:'Name, avatar, bio, skill tier;\npersists to PATCH /me',        x:1040, y:880 },
    { id:'settings',      type:'screen',  label:'Settings (v2.1)',         subtitle:'Notification toggles, units,\nradius, privacy, theme',         x:1040, y:1010 },
    { id:'notifications', type:'screen',  label:'Notifications',           subtitle:'Real inbox; tap → deep-link;\nweb-push opt-in banner',         x:1040, y:1140 },
    { id:'messages',      type:'screen',  label:'Messages (DM list)',      subtitle:'1:1 conversation threads;\n"New message" player search',       x:1240, y:880 },
    { id:'chat',          type:'screen',  label:'Direct Message Chat',     subtitle:'Thread + composer;\nrealtime via SSE',                         x:1240, y:1010 },
    { id:'payment-hist',  type:'screen',  label:'Payment History',         subtitle:'KPIs, 6-month bar chart,\nreceipts list',                       x:1240, y:1140 },
    { id:'test-email',    type:'screen',  label:'Test Email (admin tool)', subtitle:'Send sample transactional\nemails for template preview',        x:1240, y:1270 },

    // ── OWNER DASHBOARD ────────────────────────────────────────────────────
    { id:'owner-home',    type:'screen',  label:'Owner Dashboard',         subtitle:'Revenue hero, KPIs, cross-venue\npending/upcoming, quick actions',x:1520,y:620 },
    { id:'owner-profile', type:'screen',  label:'Owner Profile',           subtitle:'Venue owner identity;\nrole badge, venue list, links',        x:1520, y:880 },

    // ── OWNER — VENUES ─────────────────────────────────────────────────────
    { id:'owner-venues',  type:'screen',  label:'Owner — My Venues',       subtitle:'Venue cards + glance stats;\nCreate / Claim buttons',          x:1720, y:750 },
    { id:'owner-venue',   type:'screen',  label:'Venue Editor',            subtitle:'Tabs: Overview · Insights ·\nBookings · Membership · Listing ·\nLocation · Courts · FAQs · Photos · Staff', x:1720, y:880 },
    { id:'owner-new-venue',type:'action', label:'Create Venue',            subtitle:'Name + address autocomplete\n+ map pin + contact',              x:1560, y:1010 },
    { id:'claim-venue',   type:'action',  label:'Claim Venue',             subtitle:'Search unclaimed directory\nlisting → submit proof',            x:1880, y:1010 },
    { id:'sub-plans',     type:'screen',  label:'Subscription Plans',      subtitle:'CRUD membership tiers;\nversioned: edit → new version',        x:1720, y:1010 },

    // ── OWNER — OPERATIONS ─────────────────────────────────────────────────
    { id:'owner-bookings',type:'screen',  label:'Bookings Inbox',          subtitle:'Upcoming/Ongoing/Past tabs;\nApprove→await pay, Decline, Cancel',x:1960,y:750 },
    { id:'owner-frontdesk',type:'screen', label:'Front Desk',              subtitle:'Today\'s schedule, pending\napprovals, +Add booking, Block slot',x:1960,y:880 },
    { id:'owner-insights',type:'screen',  label:'Insights / Analytics',    subtitle:'Combined trends +\nper-venue compare',                          x:1960, y:1010 },
    { id:'owner-games',   type:'screen',  label:'Owner — Your Courts',     subtitle:'Schedule: bookings + games\nper day; Games at venues',          x:1960, y:1140 },
    { id:'owner-nearby',  type:'screen',  label:'Owner — Nearby Map',      subtitle:'Your venues as live-status\npins; attention-sorted list',       x:1960, y:1270 },
    { id:'owner-pricing', type:'screen',  label:'Owner Pricing',           subtitle:'Cross-venue pricing overview;\nreached from Sidebar + Nearby',  x:1720, y:1140 },

    // ── OWNER — ADMIN ──────────────────────────────────────────────────────
    { id:'owner-staff',   type:'screen',  label:'Staff Management',        subtitle:'Create staff logins;\nmanage ALL owner venues',                 x:2160, y:1010 },
    { id:'owner-settlements',type:'screen',label:'Settlements',            subtitle:'Payout reports +\nreconciliation',                              x:2160, y:1140 },

    // ── ORGANIZER ──────────────────────────────────────────────────────────
    { id:'org-hub',       type:'screen',  label:'Organizer Hub',           subtitle:'Tool cards: Tournaments,\nOpen Play, Rosters, Venue Reqs',      x:2380, y:620 },
    { id:'org-tournaments',type:'screen', label:'Organizer — Tournaments', subtitle:'List of own tournaments;\ncreate, manage, brackets',            x:2380, y:750 },
    { id:'org-tourn-new', type:'action',  label:'Create Tournament',       subtitle:'Draft form: name, format,\nvenue request, banner image',         x:2220, y:880 },
    { id:'org-tourn-detail',type:'screen',label:'Tournament Detail (Org)', subtitle:'Overview, participants,\nannouncements, payments',               x:2380, y:880 },
    { id:'org-bracket',   type:'screen',  label:'Bracket Manager',         subtitle:'Build/seed → generate →\nround-by-round match cards',           x:2540, y:880 },
    { id:'org-openplay',  type:'screen',  label:'Open Play Series',        subtitle:'Recurring sessions;\ncreate + per-session roster',              x:2220, y:1010 },
    { id:'org-session',   type:'screen',  label:'Session Roster',          subtitle:'Manage attendance +\npayments per session',                     x:2220, y:1140 },
    { id:'org-rosters',   type:'screen',  label:'Player Lists (Rosters)',  subtitle:'Reusable named rosters;\ncreate + member CRUD',                  x:2540, y:1010 },
    { id:'org-roster',    type:'screen',  label:'Roster Detail',           subtitle:'Add/remove members;\nimport from past events',                   x:2540, y:1140 },
    { id:'org-venue-req', type:'screen',  label:'Venue Requests',          subtitle:'Submit + track tournament\nvenue requests',                       x:2380, y:1010 },

    // ── ADMIN ──────────────────────────────────────────────────────────────
    { id:'admin-claims',  type:'screen',  label:'Admin — Venue Claims',    subtitle:'Review ownership claims:\nApprove / Reject / Needs Info',        x:2700, y:750 },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // CONNECTIONS — Directed edges (from → to)
  // ═══════════════════════════════════════════════════════════════════════════
  const DEFAULT_CONNECTIONS = [
    // ── Auth flow ─────────────────────────────────────────────────────────
    { from:'splash',         to:'landing' },
    { from:'landing',        to:'login' },
    { from:'landing',        to:'guest-browse' },
    { from:'login',          to:'forgot-pw' },
    { from:'forgot-pw',      to:'reset-pw' },
    { from:'reset-pw',       to:'login' },
    { from:'login',          to:'onboarding' },
    { from:'onboarding',     to:'role-split' },
    { from:'guest-browse',   to:'role-split' },

    // ── Role split → dashboards ───────────────────────────────────────────
    { from:'role-split',     to:'player-home' },       // !owner → player home
    { from:'role-split',     to:'owner-home' },        // owner.access → owner dashboard

    // ── Player Home → tabs + actions ──────────────────────────────────────
    { from:'player-home',    to:'game-on' },
    { from:'player-home',    to:'nearby' },
    { from:'player-home',    to:'games-browse' },
    { from:'player-home',    to:'tournaments' },
    { from:'player-home',    to:'clubs' },
    { from:'player-home',    to:'profile' },
    { from:'player-home',    to:'search' },

    // ── Game On chooser ───────────────────────────────────────────────────
    { from:'game-on',        to:'games-browse' },        // "Join a game"
    { from:'game-on',        to:'create-game-v2' },      // "Host a lobby" (has booking)
    { from:'game-on',        to:'nearby' },              // "Host" but no booking → book court first

    // ── Nearby / Venues ───────────────────────────────────────────────────
    { from:'nearby',         to:'court-details' },
    { from:'court-details',  to:'book-court' },
    { from:'court-details',  to:'open-play-book' },
    { from:'court-details',  to:'membership' },
    { from:'book-court',     to:'checkout' },
    { from:'open-play-book', to:'checkout' },
    { from:'checkout',       to:'bk-confirmed' },
    { from:'profile',        to:'my-bookings' },
    { from:'my-bookings',    to:'booking-refund' },
    { from:'my-bookings',    to:'checkout' },             // pay an approved booking

    // ── Games ─────────────────────────────────────────────────────────────
    { from:'games-browse',   to:'game-details' },
    { from:'game-details',   to:'game-chat' },
    { from:'game-details',   to:'invite-players' },
    { from:'game-details',   to:'edit-game' },            // host can manage
    { from:'create-game-v2', to:'game-details' },         // lobby created → open it
    { from:'profile',        to:'my-games' },
    { from:'my-games',       to:'game-details' },
    { from:'my-games',       to:'edit-game' },

    // ── Tournaments ───────────────────────────────────────────────────────
    { from:'tournaments',    to:'tourn-detail' },
    { from:'tourn-detail',   to:'tourn-chat' },
    // Organizers: "Create tournament" shortcut from player tournaments tab
    { from:'tournaments',    to:'org-tourn-new' },

    // ── Clubs ─────────────────────────────────────────────────────────────
    { from:'clubs',          to:'club-details' },
    { from:'clubs',          to:'create-club' },
    { from:'create-club',    to:'club-details' },
    { from:'club-details',   to:'club-post' },
    { from:'club-details',   to:'club-chat' },
    { from:'club-details',   to:'edit-club' },
    { from:'club-post',      to:'club-post-edit' },

    // ── Profile + Social ──────────────────────────────────────────────────
    { from:'profile',        to:'edit-profile' },
    { from:'profile',        to:'settings' },
    { from:'profile',        to:'notifications' },
    { from:'profile',        to:'messages' },
    { from:'profile',        to:'payment-hist' },
    { from:'messages',       to:'chat' },
    { from:'settings',       to:'test-email' },

    // ── Player Profile → role-gated consoles ──────────────────────────────
    { from:'profile',        to:'org-hub' },             // organizer.access
    { from:'profile',        to:'admin-claims' },        // admin.moderation.manage
    // Owners get a separate Owner Profile (below); but staff/admins who also
    // see the player profile can reach these same links from there.

    // ── Owner Home → quick actions + profile ──────────────────────────────
    { from:'owner-home',     to:'owner-venues' },        // "My venues"
    { from:'owner-home',     to:'owner-frontdesk' },     // "Front desk"
    { from:'owner-home',     to:'owner-bookings' },      // "Bookings"
    { from:'owner-home',     to:'owner-insights' },      // KPIs → insights
    { from:'owner-home',     to:'owner-games' },         // "Your Courts" tab
    { from:'owner-home',     to:'owner-nearby' },        // Nearby tab (owner version)
    { from:'owner-home',     to:'owner-pricing' },       // Sidebar pricing link
    { from:'owner-home',     to:'owner-profile' },       // mascot / profile icon

    // ── Owner Profile → sub-screens ───────────────────────────────────────
    { from:'owner-profile',  to:'owner-venues' },        // "My venues" row
    { from:'owner-profile',  to:'owner-bookings' },      // "Bookings" row
    { from:'owner-profile',  to:'owner-insights' },      // "Insights" row
    { from:'owner-profile',  to:'owner-staff' },         // "Staff" row
    { from:'owner-profile',  to:'owner-new-venue' },     // "New venue" row
    { from:'owner-profile',  to:'edit-profile' },        // "Edit Profile" row
    { from:'owner-profile',  to:'settings' },            // "Settings" row
    { from:'owner-profile',  to:'notifications' },       // "Notifications" row
    { from:'owner-profile',  to:'org-hub' },             // "Organizer console" (if organizer.access)
    { from:'owner-profile',  to:'admin-claims' },        // "Venue claims" (if admin.moderation.manage)
    { from:'owner-profile',  to:'owner-settlements' },   // "Settlements" row

    // ── Owner Venues ──────────────────────────────────────────────────────
    { from:'owner-venues',   to:'owner-venue' },
    { from:'owner-venues',   to:'owner-new-venue' },
    { from:'owner-venues',   to:'claim-venue' },
    { from:'owner-new-venue',to:'owner-venue' },         // created → edit it
    { from:'owner-venue',    to:'sub-plans' },           // Membership tab → manage plans

    // ── Owner Nearby → venue actions ──────────────────────────────────────
    { from:'owner-nearby',   to:'owner-venue' },         // tap pin/glance → venue editor
    { from:'owner-nearby',   to:'claim-venue' },         // empty-state "Claim"
    { from:'owner-nearby',   to:'owner-new-venue' },     // empty-state "Create"
    { from:'owner-nearby',   to:'owner-pricing' },       // sidebar / pricing link
    { from:'owner-nearby',   to:'owner-bookings' },      // glance action

    // ── Organizer ─────────────────────────────────────────────────────────
    { from:'org-hub',        to:'org-tournaments' },
    { from:'org-hub',        to:'org-openplay' },
    { from:'org-hub',        to:'org-rosters' },
    { from:'org-hub',        to:'org-venue-req' },
    { from:'org-tournaments',to:'org-tourn-new' },
    { from:'org-tournaments',to:'org-tourn-detail' },
    { from:'org-tourn-detail',to:'org-bracket' },
    { from:'org-openplay',   to:'org-session' },
    { from:'org-rosters',    to:'org-roster' },

    // ── Owner profile also reaches admin claims ───────────────────────────
    // (already declared above via owner-profile → admin-claims)
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  let nodes = [];
  let connections = [];
  let nodeMap = {};
  let dragNode = null;
  let dragOffX = 0;
  let dragOffY = 0;
  let zoomLevel = 1.0;
  let pinchState = null;

  // Canvas panning (space+drag or middle-mouse)
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let panScrollLeft = 0;
  let panScrollTop = 0;
  let spaceHeld = false;

  const canvasContainer = document.getElementById('canvasContainer');
  const canvasViewport = document.getElementById('canvasViewport');
  const canvasContent = document.getElementById('canvasContent');
  const arrowLayer = document.getElementById('arrowLayer');
  const toastEl = document.getElementById('toast');
  const zoomLabel = document.getElementById('zoomLabel');

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════════
  function cloneNode(n) {
    return { id:n.id, type:n.type, label:n.label, subtitle:n.subtitle||undefined, x:n.x, y:n.y };
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.nodes && Array.isArray(data.nodes) && data.nodes.length > 0) {
          // Merge: use saved positions for known nodes, add any new defaults
          const savedMap = {};
          data.nodes.forEach(function(n) { savedMap[n.id] = n; });

          nodes = DEFAULT_NODES.map(function(def) {
            const saved = savedMap[def.id];
            if (saved) {
              return { id:def.id, type:def.type, label:def.label, subtitle:def.subtitle, x:saved.x, y:saved.y };
            }
            return cloneNode(def);
          });

          connections = (data.connections && data.connections.length > 0)
            ? data.connections
            : DEFAULT_CONNECTIONS.slice();
          return;
        }
      }
    } catch (_) {}

    nodes = DEFAULT_NODES.map(cloneNode);
    connections = DEFAULT_CONNECTIONS.slice();
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes:nodes, connections:connections }));
    } catch (_) {}
  }

  function saveViewportState() {
    try {
      localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify({
        zoom: zoomLevel,
        scrollLeft: canvasContainer.scrollLeft,
        scrollTop: canvasContainer.scrollTop,
      }));
    } catch (_) {}
  }

  function loadViewportState() {
    try {
      var raw = localStorage.getItem(VIEWPORT_STORAGE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        if (typeof data.zoom === 'number' && typeof data.scrollLeft === 'number' && typeof data.scrollTop === 'number') {
          return data;
        }
      }
    } catch (_) {}
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  let toastTimer = null;
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { toastEl.classList.remove('show'); toastTimer = null; }, 2000);
  }

  function escapeHTML(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function buildNodeMap() {
    nodeMap = {};
    nodes.forEach(function(n) { nodeMap[n.id] = n; });
  }

  function renderNodes() {
    var existing = canvasContent.querySelectorAll('.node');
    for (var i = 0; i < existing.length; i++) existing[i].remove();

    nodes.forEach(function(node) {
      var el = document.createElement('div');
      el.className = 'node type-' + (node.type || 'screen');
      el.setAttribute('data-node-id', node.id);
      el.style.left = node.x + 'px';
      el.style.top = node.y + 'px';

      var icon = TYPE_ICONS[node.type] || '📋';
      var subtitleHTML = node.subtitle
        ? '<div class="node-subtitle">' + escapeHTML(node.subtitle) + '</div>'
        : '';
      el.innerHTML =
        '<div class="node-type-badge">' + icon + '</div>' +
        '<div class="node-copy">' +
          '<div class="node-label">' + escapeHTML(node.label) + '</div>' +
          subtitleHTML +
        '</div>';

      el.addEventListener('mousedown', function(e) { onDragStart(e, node); });
      el.addEventListener('touchstart', function(e) { onDragStart(e, node); }, { passive:false });
      canvasContent.appendChild(el);
    });
  }

  function renderArrows() {
    buildNodeMap();
    var nodeEls = {};
    var allNodes = canvasContent.querySelectorAll('.node');
    for (var i = 0; i < allNodes.length; i++) {
      var el = allNodes[i];
      nodeEls[el.getAttribute('data-node-id')] = el;
    }

    var html = '';
    html += '<defs>\n';
    html += '  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">\n';
    html += '    <polygon points="0 0, 10 3.5, 0 7" fill="#94A3B8" />\n';
    html += '  </marker>\n';
    html += '</defs>\n';

    connections.forEach(function(conn) {
      var from = nodeMap[conn.from];
      var to = nodeMap[conn.to];
      if (!from || !to) return;

      var fromEl = nodeEls[conn.from];
      var toEl = nodeEls[conn.to];
      var fromW = fromEl ? fromEl.offsetWidth : NODE_W;
      var fromH = fromEl ? fromEl.offsetHeight : NODE_MIN_H;
      var toW = toEl ? toEl.offsetWidth : NODE_W;

      var x1 = from.x + fromW / 2;
      var y1 = from.y + fromH;
      var x2 = to.x + toW / 2;
      var y2 = to.y;

      var dy = Math.abs(y2 - y1) * 0.5;
      if (dy < 30) dy = 30;

      var d = 'M ' + x1 + ' ' + y1 +
        ' C ' + x1 + ' ' + (y1 + dy) +
        ', ' + x2 + ' ' + (y2 - dy) +
        ', ' + x2 + ' ' + y2;

      html += '<path class="arrow-path" d="' + d + '" marker-end="url(#arrowhead)" />\n';
    });

    arrowLayer.innerHTML = html;
  }

  function renderAll() { renderNodes(); renderArrows(); }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZOOM
  // ═══════════════════════════════════════════════════════════════════════════
  function clampZoom(level) { return Math.max(ZOOM_MIN, Math.min(level, ZOOM_MAX)); }
  function updateZoomLabel() { zoomLabel.textContent = Math.round(zoomLevel * 100) + '%'; }

  function getContentBounds() {
    var maxX = 0, maxY = 0;
    nodes.forEach(function(node) {
      var nodeEl = canvasContent.querySelector('[data-node-id="' + node.id + '"]');
      var nodeW = nodeEl ? nodeEl.offsetWidth : NODE_W;
      var nodeH = nodeEl ? nodeEl.offsetHeight : NODE_MIN_H;
      if (node.x + nodeW > maxX) maxX = node.x + nodeW;
      if (node.y + nodeH > maxY) maxY = node.y + nodeH;
    });
    return {
      width: Math.max(CANVAS_W_MIN, maxX + VIEWPORT_PADDING),
      height: Math.max(CANVAS_H, maxY + VIEWPORT_PADDING),
    };
  }

  function syncCanvasViewport() {
    var bounds = getContentBounds();
    var logicalW = Math.max(bounds.width, canvasContainer.clientWidth / zoomLevel);
    var logicalH = Math.max(bounds.height, canvasContainer.clientHeight / zoomLevel);
    canvasViewport.style.width = (logicalW * zoomLevel) + 'px';
    canvasViewport.style.height = (logicalH * zoomLevel) + 'px';
    canvasContent.style.width = logicalW + 'px';
    canvasContent.style.height = logicalH + 'px';
    canvasContent.style.minWidth = logicalW + 'px';
    canvasContent.style.transform = 'scale(' + zoomLevel + ')';
    updateZoomLabel();
    flushArrowRedraw();
  }

  function getCanvasPoint(clientX, clientY) {
    var rect = canvasContent.getBoundingClientRect();
    return { x:(clientX - rect.left) / zoomLevel, y:(clientY - rect.top) / zoomLevel };
  }

  function setZoom(nextZoom, clientX, clientY) {
    var cz = clampZoom(nextZoom);
    if (cz === zoomLevel) return;
    var ax = clientX, ay = clientY;
    if (typeof ax !== 'number' || typeof ay !== 'number') {
      var rect = canvasContainer.getBoundingClientRect();
      ax = rect.left + canvasContainer.clientWidth / 2;
      ay = rect.top + canvasContainer.clientHeight / 2;
    }
    var cp = getCanvasPoint(ax, ay);
    zoomLevel = cz;
    syncCanvasViewport();
    var cr = canvasContainer.getBoundingClientRect();
    canvasContainer.scrollLeft = (cp.x * zoomLevel) - (ax - cr.left);
    canvasContainer.scrollTop = (cp.y * zoomLevel) - (ay - cr.top);
    saveViewportState();
  }

  function fitCanvasToViewport() {
    var bounds = getContentBounds();
    var aw = Math.max(1, canvasContainer.clientWidth - VIEWPORT_PADDING);
    var ah = Math.max(1, canvasContainer.clientHeight - VIEWPORT_PADDING);
    zoomLevel = clampZoom(Math.min(aw / bounds.width, ah / bounds.height));
    syncCanvasViewport();
    canvasContainer.scrollLeft = 0;
    canvasContainer.scrollTop = 0;
    saveViewportState();
  }

  function recenterView() {
    var bounds = getContentBounds();
    var cw = canvasContainer.clientWidth, ch = canvasContainer.clientHeight;
    var fitW = Math.max(1, cw - VIEWPORT_PADDING * 2);
    var fitH = Math.max(1, ch - VIEWPORT_PADDING * 2);
    var fz = Math.min(fitW / bounds.width, fitH / bounds.height, 1.0);
    zoomLevel = clampZoom(Math.round(fz * 100) / 100);
    syncCanvasViewport();
    var sw = bounds.width * zoomLevel, sh = bounds.height * zoomLevel;
    canvasContainer.scrollLeft = Math.max(0, (sw - cw) / 2);
    canvasContainer.scrollTop = Math.max(0, (sh - ch) / 2);
    saveViewportState();
  }

  function zoomBy(step, clientX, clientY) {
    setZoom(Math.round((zoomLevel + step) * 100) / 100, clientX, clientY);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DRAG
  // ═══════════════════════════════════════════════════════════════════════════
  function onDragStart(e, node) {
    if (e.type === 'mousedown' && e.button !== 0) return;
    if (e.touches && e.touches.length > 1) return;
    if (spaceHeld) return;
    e.preventDefault();
    dragNode = node;
    var cx = e.touches ? e.touches[0].clientX : e.clientX;
    var cy = e.touches ? e.touches[0].clientY : e.clientY;
    var pt = getCanvasPoint(cx, cy);
    dragOffX = pt.x - node.x;
    dragOffY = pt.y - node.y;
    var nel = canvasContent.querySelector('[data-node-id="' + node.id + '"]');
    if (nel) nel.classList.add('dragging');
  }

  function onDragMove(e) {
    if (!dragNode || pinchState) return;
    e.preventDefault();
    var cx = e.touches ? e.touches[0].clientX : e.clientX;
    var cy = e.touches ? e.touches[0].clientY : e.clientY;
    var pt = getCanvasPoint(cx, cy);
    var nx = pt.x - dragOffX, ny = pt.y - dragOffY;
    var nel = canvasContent.querySelector('[data-node-id="' + dragNode.id + '"]');
    var nw = nel ? nel.offsetWidth : NODE_W;
    var nh = nel ? nel.offsetHeight : NODE_MIN_H;
    var cw = Math.max(canvasContent.offsetWidth / zoomLevel, CANVAS_W_MIN);
    nx = Math.max(0, Math.min(nx, cw - nw));
    ny = Math.max(0, Math.min(ny, CANVAS_H - nh));
    dragNode.x = Math.round(nx);
    dragNode.y = Math.round(ny);
    if (nel) { nel.style.left = dragNode.x + 'px'; nel.style.top = dragNode.y + 'px'; }
    scheduleArrowRedraw();
  }

  function onDragEnd() {
    if (!dragNode) return;
    var nel = canvasContent.querySelector('[data-node-id="' + dragNode.id + '"]');
    if (nel) nel.classList.remove('dragging');
    dragNode = null;
    flushArrowRedraw();
    saveToStorage();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PINCH ZOOM + TOUCH PAN
  // ═══════════════════════════════════════════════════════════════════════════
  var touchPanState = null; // { startX, startY, scrollLeft, scrollTop } for 1-finger pan

  function getTouchDistance(t) { var dx=t[0].clientX-t[1].clientX, dy=t[0].clientY-t[1].clientY; return Math.hypot(dx,dy); }
  function getTouchCenter(t) { return { x:(t[0].clientX+t[1].clientX)/2, y:(t[0].clientY+t[1].clientY)/2 }; }

  function onCanvasWheel(e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP, e.clientX, e.clientY);
  }

  function onCanvasTouchStart(e) {
    // 2-finger → pinch zoom
    if (e.touches.length === 2) {
      if (dragNode) onDragEnd();
      if (touchPanState) { touchPanState = null; canvasContainer.classList.remove('grabbing'); }
      e.preventDefault();
      var c = getTouchCenter(e.touches);
      pinchState = { distance:getTouchDistance(e.touches), zoom:zoomLevel, centerX:c.x, centerY:c.y };
      return;
    }
    pinchState = null;
    // 1-finger on empty canvas → touch-pan (on a node, the node's own touchstart handles drag)
    if (e.touches.length === 1 && !e.target.closest('.node')) {
      e.preventDefault();
      var t = e.touches[0];
      touchPanState = { startX: t.clientX, startY: t.clientY, scrollLeft: canvasContainer.scrollLeft, scrollTop: canvasContainer.scrollTop };
      canvasContainer.classList.add('grabbing');
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
    }
  }

  function onCanvasTouchMove(e) {
    // 2-finger pinch
    if (e.touches.length === 2 && pinchState) {
      e.preventDefault();
      var c = getTouchCenter(e.touches);
      setZoom(pinchState.zoom * getTouchDistance(e.touches) / pinchState.distance, c.x, c.y);
      return;
    }
    // 1-finger pan
    if (e.touches.length === 1 && touchPanState) {
      e.preventDefault();
      var t = e.touches[0];
      canvasContainer.scrollLeft = touchPanState.scrollLeft + (touchPanState.startX - t.clientX);
      canvasContainer.scrollTop = touchPanState.scrollTop + (touchPanState.startY - t.clientY);
    }
  }

  function onCanvasTouchEnd(e) {
    pinchState = null;
    if (touchPanState) {
      touchPanState = null;
      canvasContainer.classList.remove('grabbing');
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      saveViewportState();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CANVAS PANNING (mouse: left-drag empty, middle-mouse, space+drag)
  // ═══════════════════════════════════════════════════════════════════════════
  function onSpaceKeyDown(e) {
    if (e.code === 'Space' && !spaceHeld && document.activeElement === document.body) {
      e.preventDefault();
      spaceHeld = true;
      canvasContainer.classList.add('pan-mode');
    }
  }
  function onSpaceKeyUp(e) {
    if (e.code === 'Space') {
      spaceHeld = false;
      canvasContainer.classList.remove('pan-mode');
      if (isPanning) endPan();
    }
  }
  function startPan(cx, cy) {
    isPanning = true;
    panStartX = cx; panStartY = cy;
    panScrollLeft = canvasContainer.scrollLeft;
    panScrollTop = canvasContainer.scrollTop;
    canvasContainer.classList.add('grabbing');
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
  }
  function updatePan(cx, cy) {
    if (!isPanning) return;
    canvasContainer.scrollLeft = panScrollLeft + (panStartX - cx);
    canvasContainer.scrollTop = panScrollTop + (panStartY - cy);
  }
  function endPan() {
    isPanning = false;
    canvasContainer.classList.remove('grabbing');
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    saveViewportState();
  }

  function onCanvasMouseDown(e) {
    // Middle-mouse-button drag to pan
    if (e.button === 1) { e.preventDefault(); startPan(e.clientX, e.clientY); return; }
    if (e.button === 0) {
      // Space+drag: pan even over nodes (overrides node drag)
      if (spaceHeld) { e.preventDefault(); startPan(e.clientX, e.clientY); return; }
      // Left-click on empty canvas (not on a node) → pan
      if (!e.target.closest('.node')) {
        startPan(e.clientX, e.clientY);
      }
    }
  }
  function onCanvasMouseMove(e) { updatePan(e.clientX, e.clientY); }
  function onCanvasMouseUp(e) { if (isPanning) endPan(); }

  canvasContainer.addEventListener('mousedown', onCanvasMouseDown);
  canvasContainer.addEventListener('mouseleave', function() { if (isPanning) endPan(); });
  document.addEventListener('mousemove', onCanvasMouseMove);
  document.addEventListener('mouseup', onCanvasMouseUp);
  document.addEventListener('keydown', onSpaceKeyDown);
  document.addEventListener('keyup', onSpaceKeyUp);
  window.addEventListener('blur', function() {
    spaceHeld = false;
    canvasContainer.classList.remove('pan-mode');
    if (isPanning) endPan();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ARROW REDRAW SCHEDULING
  // ═══════════════════════════════════════════════════════════════════════════
  var arrowRafId = null;
  function scheduleArrowRedraw() {
    if (arrowRafId === null) arrowRafId = requestAnimationFrame(function() { arrowRafId = null; renderArrows(); });
  }
  function flushArrowRedraw() {
    if (arrowRafId !== null) { cancelAnimationFrame(arrowRafId); arrowRafId = null; }
    renderArrows();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GLOBAL EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('touchmove', onDragMove, { passive:false });
  document.addEventListener('touchend', onDragEnd);
  canvasContainer.addEventListener('wheel', onCanvasWheel, { passive:false });
  canvasContainer.addEventListener('touchstart', onCanvasTouchStart, { passive:false });
  canvasContainer.addEventListener('touchmove', onCanvasTouchMove, { passive:false });
  canvasContainer.addEventListener('touchend', onCanvasTouchEnd);
  canvasContainer.addEventListener('touchcancel', onCanvasTouchEnd);
  window.addEventListener('resize', syncCanvasViewport);

  // Double-click empty canvas → reset viewport
  canvasContainer.addEventListener('dblclick', function(e) {
    if (!e.target.closest('.node')) {
      recenterView();
      showToast('⊹ View centered');
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL (Export / Import JSON)
  // ═══════════════════════════════════════════════════════════════════════════
  var modalMode = null;

  function showModal(mode) {
    modalMode = mode;
    var overlay = document.getElementById('modalOverlay');
    var title = document.getElementById('modalTitle');
    var textarea = document.getElementById('modalTextarea');
    var actionBtn = document.getElementById('modalAction');

    if (mode === 'export') {
      title.textContent = 'Export JSON';
      actionBtn.textContent = 'Copy to Clipboard';
      textarea.value = JSON.stringify({ nodes:nodes, connections:connections }, null, 2);
      textarea.readOnly = true;
    } else {
      title.textContent = 'Import JSON';
      actionBtn.textContent = 'Import';
      textarea.value = '';
      textarea.readOnly = false;
    }
    overlay.classList.add('active');
    setTimeout(function() { textarea.focus(); }, 150);
  }

  function hideModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    modalMode = null;
  }

  function handleModalAction() {
    if (modalMode === 'export') {
      var textarea = document.getElementById('modalTextarea');
      textarea.select();
      try {
        navigator.clipboard.writeText(textarea.value).then(function() {
          showToast('✔ Copied to clipboard');
        }, function() {
          showToast('✔ JSON ready — select & copy from the text area');
        });
      } catch (_) { showToast('✔ JSON ready — select & copy from the text area'); }
      hideModal();
      return;
    }

    if (modalMode === 'import') {
      var raw = document.getElementById('modalTextarea').value.trim();
      if (!raw) { showToast('⚠ Please paste JSON data first'); return; }
      try {
        var data = JSON.parse(raw);
        if (!data.nodes || !Array.isArray(data.nodes) || data.nodes.length === 0) {
          throw new Error('Missing nodes array');
        }
        nodes = data.nodes.map(function(n) {
          return { id:n.id, type:n.type||'screen', label:n.label||'Untitled', subtitle:n.subtitle||undefined, x:Number(n.x)||0, y:Number(n.y)||0 };
        });
        connections = data.connections || [];
        renderAll();
        fitCanvasToViewport();
        saveToStorage();
        hideModal();
        showToast('✔ Flowchart imported (' + nodes.length + ' nodes)');
      } catch (err) {
        showToast('⚠ Invalid JSON: ' + err.message);
      }
    }
  }

  function resetLayout() {
    nodes = DEFAULT_NODES.map(cloneNode);
    connections = DEFAULT_CONNECTIONS.slice();
    renderAll();
    fitCanvasToViewport();
    saveToStorage();
    showToast('↺ Layout reset to default');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUTTON BINDINGS
  // ═══════════════════════════════════════════════════════════════════════════
  document.getElementById('btnReset').addEventListener('click', resetLayout);
  document.getElementById('btnRecenter').addEventListener('click', function() { recenterView(); showToast('⊹ View centered'); });
  document.getElementById('btnExport').addEventListener('click', function() { showModal('export'); });
  document.getElementById('btnImport').addEventListener('click', function() { showModal('import'); });
  document.getElementById('btnZoomIn').addEventListener('click', function() { zoomBy(ZOOM_STEP); });
  document.getElementById('btnZoomOut').addEventListener('click', function() { zoomBy(-ZOOM_STEP); });
  document.getElementById('modalClose').addEventListener('click', hideModal);
  document.getElementById('modalCancel').addEventListener('click', hideModal);
  document.getElementById('modalAction').addEventListener('click', handleModalAction);
  document.getElementById('modalOverlay').addEventListener('click', function(e) { if (e.target === e.currentTarget) hideModal(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && modalMode) hideModal(); });
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !modalMode && document.activeElement === document.body) {
      e.preventDefault(); resetLayout();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════════════
  loadFromStorage();
  var savedVP = loadViewportState();
  if (savedVP) { zoomLevel = clampZoom(savedVP.zoom); }
  renderAll();
  if (savedVP) {
    syncCanvasViewport();
    requestAnimationFrame(function() {
      canvasContainer.scrollLeft = savedVP.scrollLeft || 0;
      canvasContainer.scrollTop = savedVP.scrollTop || 0;
    });
  } else {
    recenterView();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGEND
  // ═══════════════════════════════════════════════════════════════════════════
  (function addLegend() {
    var legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML =
      '<span class="legend-item"><span class="legend-dot screen"></span> Screen</span>' +
      '<span class="legend-item"><span class="legend-dot decision"></span> Decision</span>' +
      '<span class="legend-item"><span class="legend-dot action"></span> Action</span>' +
      '<span class="legend-item"><span class="legend-dot success"></span> Success</span>' +
      '<span class="legend-item"><span class="legend-dot entry"></span> Entry</span>' +
      '<span class="legend-item"><span class="legend-dot group"></span> Group</span>';
    document.body.appendChild(legend);
  })();
})();
