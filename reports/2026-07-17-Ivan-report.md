# Ivan Report — 2026-07-17 (Friday): PickleDen (competitor-research site) — PickleBallers idle

- **Author:** Ivan
- **Date:** 2026-07-17 (Friday)
- **Area:** PickleDen — https://pickleden.club/ (separate project, separate server)
- **Audience:** Internal (log entry — fills the reporting gap between 07-16 and 07-21)

---

## Summary

The day's work went to **PickleDen** (https://pickleden.club/), a standalone site built
and hosted on a **different server** — not in this repository and not on this host.
No PickleBallers feature, fix, or audit work was done on this date, which is why the
reports folder jumps from the 07-16 demo runsheet to the 07-21 audit update.

**What PickleDen is for:** it presents as a pickleball venue business — the "official
website of the PickleDen pickleball clubhouse" in General Trias, Cavite, with indoor and
outdoor courts. Its purpose is **competitor research**: a credible venue-side web presence
to register with rival pickleball/court-booking platforms, see what an operator actually
gets from each of them, and feed that feature list back into PickleBallers.

**Site as built:** Book a court · Rates · Visit · Privacy Policy · Terms of Service.
Advertises court booking, rate listings, open play, community events, and email booking
confirmations.

Because PickleDen lives in its own repo on its own server, its build log is tracked there
— this entry exists only to account for the PickleBallers reporting gap.

---

## Why it matters to PickleBallers

The point of the exercise is the **feature backlog**: whatever competitor platforms give
a venue operator on signup (booking widget, rate cards, open-play scheduling, member
comms, confirmation emails, payouts, analytics) becomes a checklist of what PickleBallers'
owner side is expected to match. Anything found there should land as tracked tasks in
this project rather than staying in the research notes.

> **Note:** signing up to competitor platforms under a business identity created for
> research may run against those platforms' terms of service. Worth keeping in mind
> before anything from the exercise is published or quoted externally.

---

## PickleBallers repo activity on this date

Housekeeping only — no product changes:

| Time | Commit | Description |
|------|--------|-------------|
| 11:01 | `chore: update FILEMAPs, add weekly progress update PDF` | FILEMAP refresh + the weekly progress-update PDF drop |

No `app/`, `api/`, or `web/` behaviour changed.

---

## Reporting-gap context

| Date | Day | Status |
|------|-----|--------|
| 2026-07-16 | Thursday | ✅ Reported — [demo runsheet](2026-07-16-demo-runsheet.md) |
| **2026-07-17** | **Friday** | **PickleDen — this entry** |
| 2026-07-18 | Saturday | No work |
| 2026-07-19 | Sunday | No work |
| 2026-07-20 | Monday | PickleDen — see [2026-07-20 report](2026-07-20-Ivan-report.md) |
| 2026-07-21 | Tuesday | ✅ PickleBallers — [gaps audit update](2026-07-21-Ivan-report.md) |
