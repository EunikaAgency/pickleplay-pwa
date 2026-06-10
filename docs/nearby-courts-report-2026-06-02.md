# Nearby Courts — Progress Report

**Date:** June 2, 2026
**Area:** Mobile app (PWA) · "Nearby" tab

## What's new

- **Renamed the "Courts" tab to "Nearby"** — clearer name for finding places to play.
- **Added "Near me" search** — tap it and the app uses your location to show the courts closest to you.
- **Turned on the filters** — the quick chips and the full filter panel now actually narrow the list (before, they were for show only).
- **No account needed** — anyone browsing can use "Near me" and the filters; you don't have to sign in.

## How "Near me" works for players

- Tap **Near me** (the chip or the locate button) and allow location access.
- The list reorders to show the **closest courts first**, with the distance shown on each one.
- It only shows courts **within range of you** (about 25 miles by default), not every court in the country.
- The map zooms to your area with a "you are here" dot and pins for the nearby courts.
- You can **widen or narrow the radius** in Filters (1–50 miles).
- Tap **Near me** again to switch it off and go back to the full directory.
- If there are no courts close by, it still shows you the **nearest handful** rather than an empty screen.

## How the filters work

- **Quick chips** on the map — Games here, Indoor, Free, Lighted — toggle on/off and instantly narrow the list and map pins.
- **Filter panel** ("Filter" button) — pick court type, price, open play, a distance radius, and amenities (parking, lighting, seating, showers, etc.).
- The chips and the panel are linked — change one and the other stays in sync.
- The "Filter" button shows a small **count of how many filters are on**, and the panel's button shows **how many courts match** before you close it.

## An honest note on the data

- Only a portion of courts in the directory currently have a **map location** saved (roughly 1 in 7).
- "Near me" can only place and rank courts that have a location, so courts missing one **won't appear** in the nearby results yet.
- This is a **data gap, not a feature problem** — as more courts get their map locations added, more will show up in "Near me" automatically. No further app work is needed for that.

## Status

- Built, checked, and working in the app.
- Not yet released — ready to ship when you give the go-ahead.

## Possible next steps

- Backfill the missing court map locations so more courts surface in "Near me."
- Make the remaining filter chips (e.g. price tiers) and any future filters follow the same pattern.
