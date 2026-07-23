# Ivan Report — 2026-07-20 (Monday): PickleDen (competitor-research site) — PickleBallers groundwork only

- **Author:** Ivan
- **Date:** 2026-07-20 (Monday)
- **Area:** PickleDen — https://pickleden.club/ (separate project, separate server) · PickleBallers limited to WIP groundwork
- **Audience:** Internal (log entry — fills the reporting gap before the 07-21 audit update)

---

## Summary

Like [07-17](2026-07-17-Ivan-report.md), the bulk of this day went to **PickleDen**
(https://pickleden.club/) — a standalone venue-business site built on a **different
server**, outside this repository and this host. No PickleBallers feature shipped on
this date, which is why there is no client-facing report for 07-20.

**What PickleDen is for:** it presents as the "official website of the PickleDen
pickleball clubhouse" in General Trias, Cavite (indoor + outdoor courts), and exists to
give us a credible venue-operator identity for **competitor research** — registering with
rival pickleball/court-booking platforms to see what features an operator actually gets,
then bringing that list back into PickleBallers.

**Site as built:** Book a court · Rates · Visit · Privacy Policy · Terms of Service.
Advertises court booking, rate listings, open play, community events, and email booking
confirmations.

> **Note:** signing up to competitor platforms under a business identity created for
> research may run against those platforms' terms of service. Worth keeping in mind
> before anything from the exercise is published or quoted externally.

---

## PickleBallers repo activity on this date

Five WIP snapshot commits — no released feature:

| Time | Description |
|------|-------------|
| 10:11 | Open-play backfill scripts, address-autocomplete move, report cleanup |
| 10:45 | Report-asset moves + the `reports/` directory rule added to `CLAUDE.md` |
| 13:45 | Audit doc (groundwork for the 07-21 reliability audit) |
| 14:29 | Auth controller/model, edit profile, API + permissions tweaks |
| 14:58 | Partner-subscription role mapping, auth/permissions tweaks |

None of these were user-visible on their own — they were staged work that either fed
into the 07-21 audit pass or shipped later in the 07-21 / 07-22 batches.

---

## What this set up

- **The audit doc** written this day became the full-project reliability scan run on
  07-21 — 55 findings, tracked in
  [gap-prevention-user-facing-reliability-audit-tasks.md](gap-prevention-user-facing-reliability-audit-tasks.md).
- **Partner-subscription role mapping** fed the coach/organizer subscription work.
- **The `reports/` rule** is why generated assets, screenshots and HTML no longer land
  in this folder — hand-written `.md` reports only.
- **PickleDen's feature findings** — whatever competitor platforms hand a venue operator
  (booking widget, rate cards, open-play scheduling, member comms, confirmation emails,
  payouts, analytics) should be filed as tracked PickleBallers owner-side tasks rather
  than staying in research notes.

---

## Reporting-gap context

| Date | Day | Status |
|------|-----|--------|
| 2026-07-16 | Thursday | ✅ Reported — [demo runsheet](2026-07-16-demo-runsheet.md) |
| 2026-07-17 | Friday | PickleDen — see [2026-07-17 report](2026-07-17-Ivan-report.md) |
| 2026-07-18 | Saturday | No work |
| 2026-07-19 | Sunday | No work |
| **2026-07-20** | **Monday** | **PickleDen — this entry** |
| 2026-07-21 | Tuesday | ✅ PickleBallers — [gaps audit update](2026-07-21-Ivan-report.md) |
