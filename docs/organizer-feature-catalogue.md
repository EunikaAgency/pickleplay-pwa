# Organizer Feature Catalogue (web)

> **What this is.** A master list of *every possible* feature for the **organizer**
> role on the PickleBallers website. Gathered via a multi-agent sweep — 10
> organizer-persona brainstorms (rec-play host, tournament director, league
> commissioner, community builder, game-day ops, monetization, comms, analytics,
> safety/governance) + a scan of real-world tools (Pickleheads, CourtReserve,
> Global Pickleball Network, DUPR, TeamReach, PickleballBrackets) + a backend
> reuse mapping. Deduped from 265 raw ideas. Date: 2026-06-08. Scope: **web + the
> shared `api/`**, never the PWA ("sa web lang muna").
>
> Companion implementation plan (the first three builds, in detail):
> `~/.claude/plans/list-me-all-the-proud-stonebraker.md`.

## Legend
- ✅ **Shipped** — already in the product today
- 🟡 **Reuse** — backend/infra already exists; mostly needs wiring (lower effort)
- 🔵 **New** — needs building
- ⭐ **Prioritized** — first builds, detailed in the plan (P1 / P2 / P3)

---

## Already shipped today (baseline)
Tournament CRUD + lifecycle (draft → … → completed); venue requests to owners
(with court-conflict check); participant roster; **brackets** — single/double
elim, round-robin, pool-play, entrants build/seed, per-game scoring (bo1/3/5,
11/15/21, win-by-2), walkovers, byes, first-round swap, standings/tiebreakers,
pan/zoom view. Player-level: casual games (vote-on-venue), court booking
(test-mode payment). Permissions wired: `organizer.access`,
`organizer.tournaments.manage`, `organizer.brackets.manage`.

---

## 1. Communication & notifications
- ⭐**P1 — Tournament announcements & participant messaging** 🟡 — broadcast to all
  registered players; covers the "storm → day-2 matches rescheduled / moved to
  another venue" case. Reuses the existing `Notification` model (first generator).
- Broadcast message templates 🔵 — weather-cancel / reschedule / venue-change /
  bracket-updated / next-match presets.
- One-tap venue-change & schedule-change alert 🟡
- Automated reminders (7d / 2d / 24h / 2h before) 🔵 — needs a scheduler.
- Per-match reminders ("you play next, Court 3") 🔵
- Waitlist-promotion notices 🟡 — auto-notify when a spot opens.
- RSVP confirmation requests 🔵
- Bracket/match-assignment notifications 🔵 · Match-result notifications 🔵
- Session-cancellation notifications 🟡
- Channels: in-app + web push 🟡 · email 🔵 · SMS (Twilio) 🔵
- Per-player notification preferences / opt-in by type 🔵
- In-app chat / tournament lobby (Q&A, carpool, partner-finding) 🔵
- Email digest / weekly recap 🔵 · email campaign + drip builder 🔵
- Invite by phone number (SMS) 🔵
- Pinned FAQ / Q&A module 🔵
- Weather-forecast alerts + auto-reschedule suggestions 🔵

## 2. Scheduling, formats & competition structures
**Recurring / series**
- ⭐**P2 — Recurring open-play sessions** 🟡 — finish the read-only
  `OpenPlaySession` (write API + console); activates dormant
  `organizer.events.manage`.
- Session templates (save & duplicate) 🔵
**Leagues / seasons / ladders** (the whole `organizer.events.manage` frontier)
- Seasons (multi-week, deadlines, standings) 🔵 · Divisions (skill/geo) 🔵
- Fixtures / auto round-robin or Swiss schedule 🔵 · Ladders (perpetual) 🔵
- Recurring league management 🔵 · Playoffs from standings 🔵
- Promotion & relegation 🔵 · Makeup games / rescheduling 🔵 · Swiss pairing 🔵
**Tournament & bracket advanced**
- Divisional brackets (age/gender/skill) 🔵
- Consolation / 3rd / 5th-place brackets 🔵
- Match schedule generation across days/courts 🔵 · Multi-court coordination 🔵
- Bye assignment & bracket balancing 🟡 · Seeding-rules library (DUPR/H2H) 🟡
- Round-robin tiebreaker config 🟡 · Scoring variants (bonus/rally) 🟡
- Bracket regeneration / format switching 🟡
- Mid-tournament venue change → propagate to matches + notify 🟡
- Multi-day rescheduling (weather) 🔵 · Schedule-change conflict check 🔵
- Event timeline & checklists 🔵 · iCal export 🔵 · live registration-count ticker 🟡

## 3. Registration & rosters
- Waitlist management + auto-promotion 🟡
- Reusable player rosters ("Regulars", "Advanced") 🔵
- Player directory / roster mgmt (filter by skill) 🟡
- Partner / doubles pairing at registration 🟡 · entrant withdrawal & substitution 🟡
- Invite-only tournament links 🔵 · team/club rosters & multi-event registration 🔵
- Age/gender division filtering 🔵 · attendance tracking 🟡
- Skill-level validation / DUPR integration 🔵
- Custom RSVP fields 🔵 · invitation workflows (email/SMS RSVP link) 🔵

## 4. Game-day operations
- ✅ Live game-by-game score entry · ✅ round-robin/pool scheduler · ✅ first-round
  swap · ✅ walkover/bye handling · ✅ pan/zoom bracket view
- On-site check-in (QR / manual) 🔵 · no-show tracking 🔵
- Court-assignment board (drag-drop) 🔵 · venue conflict / court blocking 🟡
- King-of-court rotation engine 🔵 · player queue & standby 🔵
- Partner mixer / on-site pairing 🔵 · skill-based game balancing 🔵
- Live match timer & horns 🔵 · referee / line-judge assignment 🔵
- Score dispute & protest resolution 🔵 · match notes & incident logging 🔵
- Public live bracket & standings feed (spectator mode) 🟡
- Mobile/tablet courtside scorekeeping companion 🟡
- Day-of roster edits (late arrivals) 🟡 · quick mini-bracket from a session 🟡
- Equipment / ball tracking 🔵 · weather auto-pause 🔵 · hydration/rest alerts 🔵

## 5. Money
- ⭐**P3 — Payment tracking driven by admin test-mode** 🟡 — connect the admin
  dashboard toggle to the settings API; organizer ledger (paid/owe + note + TEST
  banner). Plumbing largely exists (`AppSettings.paymentTestMode`,
  `isPaymentTestMode()`, payments/bookings already branch on it).
- Tournament entry fees (collect at registration) 🟡 · cost-splitting per player 🟡
- Prize pool & payout tracking 🟡
- Refund/cancellation policy engine + auto-refund 🟡 · cancel tournament → auto-refund all 🟡
- Participant payment-status dashboard 🟡 · transaction ledger & audit trail 🟡
- Discount / promo codes 🔵 · member dues (recurring) 🔵 · season passes / bundles 🔵
- Pay-at-door / on-site payment link 🔵 · sponsor & prize management 🔵
- Expense & budget tracker 🔵 · invoice & receipt generation 🔵 · late/no-show fees 🔵
- Organizer payouts & disbursement 🔵 *(real gateway — deferred)* · payment chase workflow 🔵
- Financial / tax reports 🔵 · chargeback/dispute inbox 🔵 · court-rental cost tracking 🔵
- Waitlist → paid conversion 🔵

## 6. Analytics, ratings & reports
- ✅ Game-by-game breakdown · ✅ standings & tiebreakers (RR/pool)
- Organizer analytics dashboard (attendance, fill-rate, revenue, retention) 🔵
- Standings/leaderboard export (CSV/PDF) 🟡 · stats dashboard (completion %, avg) 🟡
- Player rating system (DUPR-style ELO) 🔵 · season ratings/ELO 🔵
- Attendance & fill-rate analytics 🔵 · retention & churn reports 🔵
- Player reliability scores (no-show based) 🔵
- Head-to-head records 🔵 · per-player match history 🔵 · win-loss records 🔵
- Player search/filter by stats 🔵 · skill heatmap & recruitment 🔵
- Event reports & winner certification (PDF) 🔵 · post-event surveys 🔵
- Tournament reviews & ratings (players → event) 🔵 · revenue forecast by deadline 🔵
- CSV export (registrations/results/rosters/revenue) 🔵 · AI schedule optimizer 🔵

## 7. Community & discovery
- Public organizer profile & discovery 🔵 · public calendar / upcoming events 🔵
- Followers / follow an organizer 🔵 · organizer clubs & groups (umbrella) 🔵
- Player → organizer ratings & reviews 🔵 · photo/media gallery per event 🔵
- Event badges & loyalty 🔵 · referral program 🔵 · sponsor logo / branding 🔵
- Live leaderboard & social feed 🔵 · spectator view (public link) 🟡
- Participant engagement badges (MVP, perfect attendance) 🔵

## 8. Safety, rules & governance
- Waiver & liability management 🔵 · eligibility rules engine 🔵
- Structured age/gender divisions 🔵 · complaint & dispute workflow 🔵
- Player blocklist 🔵 · photo/media consent 🔵 · accessibility questions 🔵
- Organizer verification & badges 🔵 · court conflict detection 🟡 *(in venue approval)*
- Rules/scoring clarification library 🔵

## 9. Delegation
- Co-host / assistant with scoped permissions 🔵 *(Game `coHostId` stub exists)*
- Referee & volunteer management 🔵

## 10. Quality-of-life & dashboard
- Tournament/session cloning (duplicate-as-template) 🔵 · template library 🔵
- Printable scoresheets & brackets (PDF) 🔵 · calendar (.ics) export 🔵
- Organizer master calendar / multi-event view 🟡 · dashboard tasks/notifications widget 🟡
- Responsive on-site organizer console 🟡

---

## Suggested build order
The plan sequences the highest-leverage first builds:
**P1 announcements → P2 recurring sessions → P3 payment tracking (test-mode)**,
then roster CRM + invite links → attendance/waitlist/approval → automated
reminders → rotation scheduler → co-host → analytics → public pages → QoL.
Each new capability follows the repo rules: gate with a permission (synced across
all three `permissions` copies + catalogue + role defaults), update the API
`/lists` catalogue, both `FILEMAP.md`s, the web `DONE.md`/`TASKS.md`, and the
public roadmap.
