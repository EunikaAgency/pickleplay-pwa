#!/usr/bin/env bash
# =============================================================================
# PickleBallers Progress Report Generator
# =============================================================================
# Compiles all reports in /var/public/pickleplay/reports/ into a structured
# progress summary suitable for screen recording.
#
# Usage:
#   ./reports/progress-report.sh          # Full report
#   ./reports/progress-report.sh --short  # Compact version
#   ./reports/progress-report.sh --stats  # Just the numbers
#   ./reports/progress-report.sh --features  # Feature list only
# =============================================================================

set -euo pipefail

REPORTS_DIR="$(cd "$(dirname "$0")" && pwd)"
MODE="${1:-full}"

# Colors for terminal output
BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

section()    { echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════════════════════════${NC}"; echo -e "${BOLD}${CYAN}  $*${NC}"; echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════════════${NC}\n"; }
subsection() { echo -e "\n${BOLD}${YELLOW}── $* ──${NC}\n"; }
kpi()        { echo -e "  ${BOLD}$1${NC}: ${GREEN}$2${NC}"; }
label()      { echo -e "  ${DIM}$1${DIM}"; }
item()       { echo -e "  ${GREEN}✓${NC} $*"; }
gap()        { echo -e "  ${RED}◯${NC} $*"; }

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
header() {
    clear 2>/dev/null || true
    echo -e "${BOLD}${MAGENTA}"
    echo "  ╔══════════════════════════════════════════════════════════════╗"
    echo "  ║                                                              ║"
    echo "  ║           🏓  PICKLEBALLERS  —  PROGRESS REPORT  🏓            ║"
    echo "  ║                                                              ║"
    echo "  ║              June 5 – June 30, 2026  (26 days)               ║"
    echo "  ║                                                              ║"
    echo "  ╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo -e "  ${DIM}Author: Ivan  |  All reports from /var/public/pickleplay/reports/${NC}"
}

# ---------------------------------------------------------------------------
# Stats / KPIs
# ---------------------------------------------------------------------------
show_stats() {
    section "📊  BY THE NUMBERS"

    local report_count=$(ls -1 "$REPORTS_DIR"/*.md 2>/dev/null | wc -l)

    echo -e "  ${BOLD}${report_count}${NC} report files over ${BOLD}26 days${NC} (June 5 – June 30, 2026)"
    echo ""

    kpi "Total report files"          "10"
    kpi "Development days"            "10 active days"
    kpi "Frontend surfaces"           "3 (API backend, PWA app, Web organizer)"
    kpi "Features shipped"            "50+ across all surfaces"
    kpi "API endpoints built"         "100+ new/modified routes"
    kpi "New permissions created"     "9 new permission keys"
    kpi "Web routes added (June 29)"  "23 new routes"
    kpi "New web files (June 29)"     "30 new files"
    kpi "Demo readiness (CSV)"        "53/54 rows DONE or Deferred"
    kpi "PDF demo requirements"       "14/14 met"
    kpi "API bugs found in audit"     "0"
    kpi "Committed & pushed"          "Splash (June 19), Booking link batch (June 24)"
    kpi "Pending commit"              "Majority of work — awaiting review"

    echo ""
    echo -e "  ${DIM}Areas touched:${NC}"
    echo ""
    echo -e "    ${BOLD}api/${NC}   Backend: tournaments, clubs, messaging, notifications,"
    echo "           bookings, venues, staff, demand, settlements, receipts,"
    echo "           payouts, waitlist, brackets, push (FCM), auto-pricing"
    echo ""
    echo -e "    ${BOLD}app/${NC}   PWA: home, search, profile, settings, messages, games,"
    echo "           bookings, checkout, venues, owner console, organizer,"
    echo "           notifications, clubs, splash, tournaments, brackets"
    echo ""
    echo -e "    ${BOLD}web/${NC}   Website: clubs, organizer console, owner console,"
    echo "           splash, dashboard, messages, notifications, tournaments,"
    echo "           games, bookings, settings, onboarding"
}

# ---------------------------------------------------------------------------
# Timeline (day by day)
# ---------------------------------------------------------------------------
show_timeline() {
    section "📅  TIMELINE"

    echo -e "  ${BOLD}${BLUE}Jun 5  ${NC} │ ${BOLD}Tournament Brackets${NC}"
    echo "         │ Bracket engine (4 formats), web organizer UI, pan/zoom canvas,"
    echo "         │ match scoring, player swap/re-seed, 34 unit tests"
    echo ""
    echo -e "  ${BOLD}${BLUE}Jun 8  ${NC} │ ${BOLD}Clubs & Organizer Toolkit${NC}"
    echo "         │ Clubs (create/browse/join/post/SSE), 5 organizer features:"
    echo "         │ announcements, recurring open play, rosters, attendance/waitlist,"
    echo "         │ payment tracking. Full-width dashboard sweep (~30 files)"
    echo ""
    echo -e "  ${BOLD}${BLUE}Jun 17 ${NC} │ ${BOLD}Realtime Notifications & Messaging${NC}"
    echo "         │ Game invites, live unread badge (30s poll), tournament alerts,"
    echo "         │ 1-on-1 direct messaging, message notifications"
    echo ""
    echo -e "  ${BOLD}${BLUE}Jun 18 ${NC} │ ${BOLD}V2 Profile, Settings & Chat (MASSIVE DAY — 5 reports)${NC}"
    echo "         │ Cross-entity search (courts/games/clubs/players), payment history"
    echo "         │ with 6-month spend graph, realtime SSE stream, message anyone,"
    echo "         │ game group chat, delete conversations, profile photo + crop,"
    echo "         │ settings persistence (preferences blob), v2.1 dark mode,"
    echo "         │ settings shell + logout, mark-all-read fix, screen session restore"
    echo ""
    echo -e "  ${BOLD}${BLUE}Jun 19 ${NC} │ ${BOLD}Animated Launch Splash${NC} (COMMITTED)"
    echo "         │ App + web animated splash (ball serve, wordmark, badges, wipe),"
    echo "         │ once-per-session, reduced-motion support"
    echo ""
    echo -e "  ${BOLD}${BLUE}Jun 24 ${NC} │ ${BOLD}Venue Owner Tools${NC}"
    echo "         │ Claim venue (search + proof), slimmer create with address"
    echo "         │ autocomplete, system booking link + custom slug, per-court setup"
    echo "         │ with photo gallery + weekly hours, owner profile tab"
    echo ""
    echo -e "  ${BOLD}${BLUE}Jun 25 ${NC} │ ${BOLD}Court Editor Polish${NC}"
    echo "         │ Court editor → 3 tabs (Info/Gallery/Hours), gallery lightbox,"
    echo "         │ hours-pricing layout fix"
    echo ""
    echo -e "  ${BOLD}${BLUE}Jun 26 ${NC} │ ${BOLD}Owner Features (BIG DAY — staff + 6 medium features)${NC}"
    echo "         │ Manual booking + slot blocking, front-desk dashboard,"
    echo "         │ deposit/full/pay-at-venue checkout, 7% service fee,"
    echo "         │ owner staff accounts (org-level delegation),"
    echo "         │ booking modification API, waitlist system API,"
    echo "         │ BIR official receipts API, payout settlements API,"
    echo "         │ cash leakage mitigation, owner↔player venue messaging"
    echo ""
    echo -e "  ${BOLD}${BLUE}Jun 29 ${NC} │ ${BOLD}App Audit & Web Parity${NC}"
    echo "         │ Full CSV audit (53/54 rows done), 19 features API-verified,"
    echo "         │ 14/14 PDF demo requirements met, bracket view rewrite (app→web),"
    echo "         │ organizer role gates, notification fixes (delete/unified/sticky),"
    echo "         │ insights tab consolidation, FAQ accordion, web parity sprint:"
    echo "         │ 30 new files, 23 routes, 7 owner tabs, 14 player screens"
    echo ""
    echo -e "  ${BOLD}${BLUE}Jun 30 ${NC} │ ${BOLD}Push Notifications & Auto Pricing${NC}"
    echo "         │ FCM dual-channel push (Android + VAPID), automated dynamic pricing"
    echo "         │ (nightly cron, confidence-based), pricing UI cleanup (5→3 sections),"
    echo "         │ card border standardization, owner bookings/insights/map polish,"
    echo "         │ chat hover actions + reply + composer redesign"
}

# ---------------------------------------------------------------------------
# Feature inventory by area
# ---------------------------------------------------------------------------
show_features() {
    section "🧩  FEATURE INVENTORY BY AREA"

    subsection "TOURNAMENTS & BRACKETS (Jun 5 → Jun 29)"
    item "Bracket engine — single/double elimination, round robin, pool play"
    item "Match scoring with best-of (bo1/bo3/bo5), win-by-2 validation"
    item "Web organizer bracket UI with connector lines, pan/zoom canvas"
    item "Player swap/re-seed before first round"
    item "Bracket view rewritten on app (June 29) — full parity with web"
    item "Organizer role gate — can't join games/tournaments as player"
    item "API level 403 guards on joinGame + registerForTournament"

    subsection "CLUBS (Jun 8)"
    item "Club CRUD — public/private, cover photo, member limit"
    item "Realtime feed — posts + replies (recursive), likes, SSE stream"
    item "Notification fan-out per club activity"
    item "Player/coach dashboard integration, My Groups"
    item "Web: Edit club, club post permalink pages"

    subsection "MESSAGING & NOTIFICATIONS (Jun 17 → Jun 30)"
    item "1-on-1 direct messaging — conversations + chat screen"
    item "Realtime SSE stream (per-user EventSource)"
    item "Game group chat — roster-scoped, realtime"
    item "Message anyone flow (search → startConversation → chat)"
    item "Delete conversation (soft/hide) + delete message (sender hard delete)"
    item "FCM + VAPID dual-channel push notifications (June 30)"
    item "Live unread badge (30s polling + SSE), notification bell"
    item "Unified notification screen (owner + player merged)"
    item "Delete individual notifications, mark-all-read pill"
    item "Club post deep links, sticky notification header"
    item "Chat hover actions (reply, 3-dot menu), reply preview in message list"
    item "Composer visual separation (white bg, clear borders, shadow)"
    item "Web: Notifications, Messages, Chat (1:1) dashboard pages"

    subsection "PLAYER PROFILE & SETTINGS (Jun 18)"
    item "Cross-entity search — courts, games, clubs, players (type=all)"
    item "Payment history — KPIs, 6-month bar graph, receipts list"
    item "V2.1 Settings screen — shell + logout → full (preferences persistence)"
    item "App-wide dark mode (v2.1) — dark-navy palette, per-device"
    item "Profile photo upload with circular crop (croppie)"
    item "Settings persistence — notification toggles, units (km/mi)"
    item "Session restore — screen stack survives reload"
    item "Web: Enhanced settings (prefs, radius, units, privacy)"
    item "Web: Onboarding wizard (3 steps: skill, city, confirmation)"

    subsection "VENUES & BOOKINGS (Jun 24 → Jun 30)"
    item "Claim venue — search unclaimed, proof form, admin review"
    item "Smart address autocomplete with map pin"
    item "Auto-generated booking link + custom slug + live availability check"
    item "Per-court setup — name, description, photo gallery, weekly hours"
    item "Court editor split into 3 tabs (Info / Gallery / Hours)"
    item "Gallery lightbox, fixed remove button positioning"
    item "Manual booking + slot blocking (walk-in/phone/Messenger/IG)"
    item "Deposit / Full / Pay-at-venue payment options"
    item "7% platform service fee on all bookings"
    item "Pricing UI cleanup — 5 sections → 3 clean sections"
    item "Pricing precedence hierarchy documented in UI"
    item "Booking modification — date/time/court changes, 3-max, audit log"
    item "Waitlist system — auto-promote on cancel, 2h claim window"
    item "Recurring bookings, split-court, equipment rental"
    item "FAQ accordion on venue detail + owner editor"
    item "Web: Front desk, staff, settlements, claim venue pages"
    item "Web: 15 venue editor tabs (was 10), 7 new tabs built"

    subsection "OWNER CONSOLE (Jun 24 → Jun 30)"
    item "Front-desk dashboard — today's schedule, pending approvals, KPIs"
    item "Owner staff accounts — org-level delegation (new 'staff' role)"
    item "effectiveOwnerId — staff inherits owner's resources"
    item "Owner profile tab with venue-business content"
    item "Owner home: unread badge, 6-venue grid, front-desk quick action"
    item "Insights tab consolidation — Demand + Leakage merged in"
    item "Demand tab — 9 signals, 24h heatmap, occupancy %"
    item "Leakage tab — funnel bar chart, daily breakdown, KPIs"
    item "Cash leakage mitigation — checkout_started/abandoned, link_shared events"
    item "Pricing suggestions card — AI demand-based, multi-select, bulk apply"
    item "Automated dynamic pricing — nightly cron, confidence-based"
    item "AutoPricingToggle — master on/off, confidence slider, max adjustment"
    item "Card border standardization — slate-200, consistent across all cards"
    item "Owner bookings card redesign, insights tab UI polish"
    item "Map pin labels fix — remove confusing '0' markers"
    item "Web: OwnerStat, BookingLinkShare, PricingSuggestionsCard components"

    subsection "FINANCE & COMPLIANCE (Jun 26)"
    item "BIR Official Receipts — auto-generate on confirm, sequential OR numbering"
    item "Player receipts screen + OR popup"
    item "Payout settlements — gross→net, per-venue breakdown"
    item "Owner payout methods — bank transfer, GCash, Maya"
    item "gap \"Owner-side BIR receipt management screen (ONLY remaining code gap)\""

    subsection "SPLASH (Jun 19) — COMMITTED"
    item "Animated launch splash on app + web"
    item "Once per browser session, reduced-motion support"
    item "Web: full viewport, auto-advance; App: tap-to-enter"

    subsection "DARK MODE & DESIGN (Jun 18 → Jun 30)"
    item "V2.1 app-wide dark mode — dark-navy palette"
    item "Forced --on-accent on all lime surfaces (legibility)"
    item "Card border standardization (June 30)"
    item "Chart polish — bar rounding, spacing, gap"
    item "Bottom nav solid surface, design switcher collapsible"
}

# ---------------------------------------------------------------------------
# Remaining gaps
# ---------------------------------------------------------------------------
show_gaps() {
    section "🔴  REMAINING GAPS"

    gap "Owner-side BIR Official Receipt management screen"
    label "  API done. Player side done. Need: listVenueReceipts() + owner receipt list + issue/void UI."

    echo ""
    echo -e "  ${YELLOW}Deferred (by design):${NC}"
    echo ""
    label "  • Automated dynamic pricing — needs enough booking data first (opt-in engine built)"
    label "  • Busiest hours / underused slots / revenue-by-court analytics"
    label "  • Automated reminders (day-before / hour-before) — needs scheduler"
    label "  • Share/repost, GIF-by-URL, deeper reply threading for clubs"
    label "  • SSE scaling (single-instance; Redis pub/sub documented for multi-instance)"
    label "  • Push theme preference to server (currently localStorage-only)"

    echo ""
    echo -e "  ${DIM}Process items (non-code):${NC}"
    echo ""
    label "  • Map owner features by priority (matrix)"
    label "  • Research first target venues"
    label "  • Schedule recurring demo reviews"
}

# ---------------------------------------------------------------------------
# Roadmap / Sprint summary
# ---------------------------------------------------------------------------
show_roadmap() {
    section "🗺️  SPRINT SUMMARY — 26 DAYS OF BUILDING"

    echo -e "  ${BOLD}Week 1 (Jun 5-8): Foundation${NC}"
    echo "  Tournament brackets + engine  •  Clubs platform  •  Organizer toolkit (5 features)"
    echo ""
    echo -e "  ${BOLD}Week 2 (Jun 17-19): Player Experience${NC}"
    echo "  Realtime notifications  •  Direct messaging  •  Cross-entity search"
    echo "  Payment history  •  V2 profile/settings  •  Dark mode  •  Animated splash"
    echo ""
    echo -e "  ${BOLD}Week 3 (Jun 24-26): Owner Platform${NC}"
    echo "  Venue claim  •  Address autocomplete  •  Booking links  •  Per-court setup"
    echo "  Manual booking  •  Front desk dashboard  •  Staff accounts  •  Payment options"
    echo "  Service fee  •  6 medium API features (bookings/waitlist/receipts/settlements)"
    echo ""
    echo -e "  ${BOLD}Week 4 (Jun 29-30): Polish & Launch Prep${NC}"
    echo "  Full CSV audit  •  Web parity sprint  •  Organizer gates  •  Notification fixes"
    echo "  FCM push  •  Auto dynamic pricing  •  UI cleanup  •  Card standardization"
    echo "  Chat actions/reply  •  Map fixes  •  Insights polish"
    echo ""
    echo -e "  ${BOLD}${GREEN}Status: DEMO-READY. 99% complete. 1 code gap remains.${NC}"
}

# ---------------------------------------------------------------------------
# Short version
# ---------------------------------------------------------------------------
show_short() {
    header
    echo ""
    section "📊  QUICK SUMMARY"
    echo ""
    echo -e "  ${BOLD}10 reports${NC} over ${BOLD}26 days${NC} (June 5–30, 2026)"
    echo -e "  ${BOLD}50+ features${NC} shipped across API, PWA app, and Web organizer"
    echo -e "  ${BOLD}100+ API endpoints${NC} built or modified"
    echo -e "  ${BOLD}3 frontend surfaces${NC} maintained in sync"
    echo ""
    echo -e "  ${GREEN}53/54${NC} CSV rows DONE or Deferred"
    echo -e "  ${GREEN}14/14${NC} PDF demo requirements met"
    echo -e "  ${GREEN}0${NC} API bugs found in full audit"
    echo ""
    echo -e "  ${RED}1 remaining gap:${NC} Owner-side BIR receipt screen"
    echo ""

    section "📅  KEY MILESTONES"
    echo ""
    echo -e "  ${BLUE}Jun 5  ${NC} Tournament brackets engine + web UI"
    echo -e "  ${BLUE}Jun 8  ${NC} Clubs (realtime SSE) + Organizer toolkit (5 features)"
    echo -e "  ${BLUE}Jun 17 ${NC} Realtime notifications + 1-on-1 messaging"
    echo -e "  ${BLUE}Jun 18 ${NC} Search, payment history, SSE stream, game chat, dark mode"
    echo -e "  ${BLUE}Jun 19 ${NC} Animated splash (COMMITTED) — app + web"
    echo -e "  ${BLUE}Jun 24 ${NC} Venue claim, booking links, per-court setup"
    echo -e "  ${BLUE}Jun 25 ${NC} Court editor → 3 tabs + gallery lightbox"
    echo -e "  ${BLUE}Jun 26 ${NC} Manual booking, staff accounts, 6 medium API features"
    echo -e "  ${BLUE}Jun 29 ${NC} Full audit (53/54 done) + Web parity (30 files, 23 routes)"
    echo -e "  ${BLUE}Jun 30 ${NC} FCM push, auto dynamic pricing, UI polish"
    echo ""
    echo -e "  ${BOLD}${GREEN}▶ DEMO-READY. 99% complete.${NC}"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
case "$MODE" in
    --short|-s)
        show_short
        ;;
    --stats|-n)
        header
        show_stats
        ;;
    --features|-f)
        header
        show_features
        show_gaps
        ;;
    --timeline|-t)
        header
        show_timeline
        ;;
    --gaps|-g)
        header
        show_gaps
        ;;
    --roadmap|-r)
        header
        show_roadmap
        ;;
    *)
        # Full report
        header
        show_stats
        show_timeline
        show_roadmap
        show_features
        show_gaps
        echo ""
        section "📁  REPORT FILES"
        echo ""
        for f in "$REPORTS_DIR"/*.md; do
            name=$(basename "$f")
            size=$(wc -c < "$f")
            kb=$((size / 1024))
            echo -e "  ${DIM}$name${NC}  (${kb} KB)"
        done
        echo ""
        echo -e "  ${DIM}Full reports at: ${REPORTS_DIR}/${NC}"
        echo ""
        echo -e "  ${BOLD}${GREEN}▶ END OF PROGRESS REPORT${NC}"
        echo ""
        ;;
esac
