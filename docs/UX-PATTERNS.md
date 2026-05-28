# UX Patterns — Pickleheads-Inspired

## Navigation Pattern
- **Cold-start**: Lands on `LandingScreen` (welcome surface) → "Get Started" / "Sign In" → `LoginScreen`.
- **Bottom tab bar**: 5 tabs — Home, Nearby, **Create** (inlined), Clubs, Profile. The center Create tab fires `onCreate` rather than navigating to a tab screen.
- **No global top bar**: each screen owns its own header (title + back arrow when applicable).
- **No standalone FAB**: create action is inlined into the TabBar.
- **Screen transitions**: Push right for details, slide up for bottom sheets (filters, invites, DUPR explainer).

> **Was:** A global TopBar with logo + search + bell + chat icons on every tab screen, plus a standalone FAB on Home/Games for create actions. Both were removed in the May 27, 2026 redesign. See [Change History](#change-history).

## Card Pattern
Every list item is a card with:
- White surface on `#F8F9FC` background
- Blue-tinted shadow (`0 4px 20px -2px rgba(0, 64, 224, 0.10)`)
- Rounded corners (12–14px)
- Clear title, subtitle, metadata row, and one primary action

## Filter Pattern
- **Bottom sheet** opened over the current screen via the shared `BottomSheet` primitive
- Title + close button
- Categorized sections with toggles/chips/sliders
- Footer: "Clear" + "Apply" or "View N Results"
- Dismissal returns to the host screen without nav-stack changes

> **Was:** Filters were full-screen routed screens (`NearbyFiltersScreen`, `GameFiltersScreen`) that pushed onto the navigation stack. Replaced by `NearbyFilterSheet` and `GameFilterSheet` bottom sheets.

## Loading Pattern
- Use **`LoadingSkeleton`** placeholders shaped like the eventual content (card skeletons, list-row skeletons, hero skeletons)
- Never flash an empty layout before a spinner — skeletons reduce perceived latency
- Long-running blocking actions (form submits) use button-internal spinners via `Button` `loading` prop

> **Was:** Lists and detail views used a centered `LoadingSpinner`. Replaced with `LoadingSkeleton` for layout-matched placeholders.

## Demo / Review State Pattern
- A global `DemoStateProvider` wraps the app
- Any screen with data must respect the current demo state: `normal | empty | loading | error | offline`
- A floating `DemoStateControl` widget lets reviewers toggle modes at runtime — no code changes needed to demo failure surfaces
- `OfflineBanner` appears at the top of the app shell when offline mode is active or the browser reports offline

## Game Card Pattern
```
┌─────────────────────────────────┐
│ [Day] [Date]     [Player Count] │
│ Title                           │
│ Skill: 2.0-3.0                  │
│ Location                        │
│ Format badge    [Join/Details]  │
└─────────────────────────────────┘
```

## Court Card Pattern
```
┌─────────────────────────────────┐
│ Court Name                      │
│ N Courts · Surface · Access     │
│ Address snippet                 │
│ [Follow] [Directions]           │
└─────────────────────────────────┘
```

## Club Card Pattern
```
┌─────────────────────────────────┐
│ [Avatar] Club Name              │
│ Privacy badge · Skill range     │
│ N members                       │
│ [Details] [Chat]                │
└─────────────────────────────────┘
```

## Empty State Pattern
```
┌─────────────────────────────────┐
│                                 │
│        [Illustration]           │
│                                 │
│     Friendly title              │
│     Helpful description         │
│                                 │
│     [One clear CTA button]      │
│                                 │
└─────────────────────────────────┘
```

Use `CourtIllustration` and similar shared illustrations for empty/landing surfaces to keep visuals consistent.

## Detail Screen Pattern
- Screen-owned header: back button (top left) + title
- Tabs under header (Details | Players | Chat)
- Scrollable content area
- Sticky bottom action bar (for join/leave/invite actions)

## Creation Flow Pattern
- Wizard for multi-step (clubs)
- Single form for simple (games)
- Success state with immediate "Invite" prompt
- "Maybe later" escape hatch
- Use `useForm` hook + `FormField` / `FormSelect` / `FormTierPicker` to standardize inputs

## Onboarding Pattern
- Three-step inline flow on `OnboardingScreen` (welcome → location → skill)
- Each step has a clear "Continue" CTA + "Skip for now" escape hatch
- Onboarding state lives in App.tsx and currently resets on reload — persistence is a Phase 2 integration gap

---

## Change History

| Date | Change |
|---|---|
| 2026-05-27 | Navigation pattern: removed TopBar and standalone FAB; create action inlined into TabBar; LandingScreen is now cold-start entry. |
| 2026-05-27 | Filter pattern: switched from full-screen routed filters to `BottomSheet`-based filter sheets. |
| 2026-05-27 | Loading pattern: `LoadingSpinner` → `LoadingSkeleton`. |
| 2026-05-27 | Added Demo / Review State pattern (`DemoStateProvider`, `DemoStateControl`, `OfflineBanner`). |
| 2026-05-27 | Creation flows now standardized via `useForm` + `FormField` / `FormSelect` / `FormTierPicker`. |
