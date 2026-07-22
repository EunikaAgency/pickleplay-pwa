# Ivan — Map clustering + labelled pins + fullscreen toggle (22 July 2026)
**Task C, Item 1 of 7: "Mobile map clumps pins; full-screen map unreachable"**
**Status: ✅ DONE and deployed**

## What was wrong
1. **Clumping** — venues plotted as raw Leaflet `<Marker>` with the default 25×41 icon, no clustering. On Metro Manila zoom, overlapping pins hid behind each other and were untappable.
2. **FullMapScreen dead** — `FullMapScreen` (`/map`) existed but nothing navigated to it. Non-interactive pins, no clustering, no back button (`hideChrome` included `'map'`). Redundant with `/nearby`.
3. **No re-center** — the "Near me" button only re-centered when the list sheet was already collapsed; otherwise no effect.
4. **No labels on pins** — pins had no venue names; name only visible after tapping a popup.

## What was done (NearbyScreenV2.tsx)
| Change | Detail |
|--------|--------|
| Clustering | `react-leaflet-cluster` (`MarkerClusterGroup`), `maxClusterRadius=55`, `showCoverageOnHover=false`. Custom blue bubble `iconCreateFunction` with count. Base `MarkerCluster.css` imported in `index.css`. |
| Smaller labelled pins | `L.divIcon` — 14px dot + venue-name label (`pointer-events:none`, ellipsis, cached by name). Replaced default 25×41 icon. Clustering naturally mitigates label overlap at low zoom. |
| Re-center button | New `recenter()` handler always bumps `focusNonce` — works regardless of sheet state (expanded or collapsed). Inline icon button in search bar row. |
| Fullscreen toggle | Expand icon in search bar row; makes map `position:fixed; z-index:9999` covering tab bar. Exit (✕) at top-right. Fullscreen-only recenter at bottom-right. |
| FrameMap popup fix | Threaded `clusterRef`; `openNearest()` defers to `moveend` and checks `getVisibleParent(marker) === marker` before opening (silent no-op if still clustered). |
| FullMapScreen deleted | Removed file + all refs: `App.tsx` (import, render case, hideChrome), `navigation.ts` (union, pathFromScreen, screenFromLocation, deepLinkParent), `v2.css` (`.fullmap-screen`/`.fullmap-leaflet`). |

## Files changed
- `app/src/features/venues/v2/NearbyScreenV2.tsx` — main
- `app/src/features/venues/FullMapScreen.tsx` — deleted
- `app/src/shared/styles/v2.css` — cluster, pin label, icon button, fullscreen/recenter-fs, fullscreen-exit CSS
- `app/src/shared/styles/index.css` — `@import "leaflet.markercluster/dist/MarkerCluster.css"`
- `app/src/App.tsx` — removed FullMapScreen import + case + hideChrome entry
- `app/src/shared/lib/navigation.ts` — removed `'map'` screen from union/path/screenFromLocation/deepLinkParent
- `app/package.json` — `react-leaflet-cluster` + `@types/leaflet.markercluster` (dev)

## Verification
- `npm run build`: 47 pre-existing errors, **0 new**
- `npm run lint`: 1 pre-existing error (`setState-in-effect`), **0 new**
- Deployed to https://pickleballer-pwa.eunika.xyz/nearby (PM2, Vite dev mode)
- Commits: `ddff103 feat(nearby)`, `2b17ff9 fix(nearby)`, `fd82ae3 fix(nearby)`

## Related
- Task C, Item 2–7 still open
- Kenneth's team-split.html lane C reference
