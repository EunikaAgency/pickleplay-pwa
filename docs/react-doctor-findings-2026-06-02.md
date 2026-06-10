# React Doctor findings — Nearby/Courts redesign commit

**Commit:** `26f511b` — *Rename "Courts" tab to "Nearby"; add location search and working filters*  
**Scanned:** files changed vs `2230c48` (the 19 files in that commit)  
**Tool:** `react-doctor` v0.2.16 — `react-doctor --diff 2230c48 --fail-on warning`  
**Date:** 2026-06-02

> All 47 findings are **`warning` severity / advisory**. The pre-commit hook reports them but exits 0, so they did **not** block the commit, and the feature works. This list is for follow-up cleanup, not a blocker.

## Summary

| Category | Count | Rules |
|---|---|---|
| Bugs | 26 | `no-cascading-set-state` ×2, `button-has-type` ×22, `prefer-useReducer` ×2 |
| Accessibility | 2 | `control-has-associated-label` ×2 |
| Performance | 8 | `jsx-no-jsx-as-prop` ×6, `rendering-hoist-jsx` ×1, `rerender-state-only-in-handlers` ×1 |
| Maintainability | 11 | `design-no-redundant-size-axes` ×8, `no-giant-component` ×1, `no-render-in-render` ×1, `design-no-em-dash-in-jsx-text` ×1 |
| **Total** | **47** | |

## Bugs

### `no-cascading-set-state` — Multiple setState calls in one effect (×2)

**What:** 3 setState calls in one useEffect redraw your screen each time they run together.

**How to fix:** Combine into useReducer: `const [state, dispatch] = useReducer(reducer, initialState)`

**Docs:** https://www.react.doctor/docs/rules/react-doctor/no-cascading-set-state

**Where:**
- `src/features/venues/CourtDetailsScreen.tsx:26`
- `src/features/venues/NearbyScreen.tsx:217`

### `button-has-type` — Button missing explicit type (×22)

**What:** Your users can submit the form by accident because a `<button>` with no `type` defaults to submit.

**How to fix:** Always set a `type` on a `<button>`: `type="button"`, `"submit"`, or `"reset"`.

**Docs:** https://www.react.doctor/docs/rules/react-doctor/button-has-type

**Where:**
- `src/features/venues/CourtDetailsScreen.tsx:124`
- `src/features/venues/CourtDetailsScreen.tsx:128`
- `src/features/venues/CourtDetailsScreen.tsx:131`
- `src/features/venues/CourtDetailsScreen.tsx:189`
- `src/features/venues/CourtDetailsScreen.tsx:234`
- `src/features/venues/CourtDetailsScreen.tsx:242`
- `src/features/venues/NearbyScreen.tsx:505`
- `src/features/venues/NearbyScreen.tsx:514`
- `src/features/venues/NearbyScreen.tsx:517`
- `src/features/venues/NearbyScreen.tsx:524`
- `src/features/venues/NearbyScreen.tsx:531`
- `src/features/venues/NearbyScreen.tsx:538`
- `src/features/venues/NearbyScreen.tsx:552`
- `src/features/venues/NearbyScreen.tsx:611`
- `src/features/venues/NearbyScreen.tsx:640`
- `src/shared/components/layout/TabBar.tsx:30`
- `src/shared/components/layout/TabBar.tsx:45`
- `src/features/auth/OnboardingScreen.tsx:78`
- `src/features/auth/OnboardingScreen.tsx:134`
- `src/features/auth/OnboardingScreen.tsx:180`
- `src/shared/components/layout/Sidebar.tsx:52`
- `src/shared/components/layout/Sidebar.tsx:67`

### `prefer-useReducer` — Many related useState calls (×2)

**What:** 14 useState calls in "NearbyScreen" can each trigger a separate render.

**How to fix:** Group related state: `const [state, dispatch] = useReducer(reducer, { field1, field2, ... })`

**Docs:** https://www.react.doctor/docs/rules/react-doctor/prefer-useReducer

**Where:**
- `src/features/venues/NearbyScreen.tsx:157`
- `src/features/auth/OnboardingScreen.tsx:13`

## Accessibility

### `control-has-associated-label` — Control missing accessible label (×2)

**What:** Blind users can't tell what this control does because screen readers find no label, so add visible text, `aria-label`, or `aria-labelledby`.

**How to fix:** Give every interactive control a label screen readers can read.

**Docs:** https://www.react.doctor/docs/rules/react-doctor/control-has-associated-label

**Where:**
- `src/features/venues/NearbyFilterSheet.tsx:76`
- `src/features/auth/OnboardingScreen.tsx:119`

## Performance

### `jsx-no-jsx-as-prop` — JSX element passed as a prop (×6)

**What:** This child redraws every render because the prop gets brand new JSX each time.

**How to fix:** Move the JSX outside the component, or wrap it in `useMemo`.

**Docs:** https://www.react.doctor/docs/rules/react-doctor/jsx-no-jsx-as-prop

**Where:**
- `src/features/venues/CourtDetailsScreen.tsx:88`
- `src/features/venues/CourtDetailsScreen.tsx:88`
- `src/features/venues/CourtDetailsScreen.tsx:88`
- `src/features/venues/NearbyScreen.tsx:409`
- `src/features/venues/NearbyScreen.tsx:409`
- `src/features/venues/NearbyScreen.tsx:409`

### `rendering-hoist-jsx` — Constant JSX rebuilt each render (×1)

**What:** This rebuilds on every render because static JSX "emptyUI" is built inside the component, so move it to the top of the file to make it just once

**How to fix:** Move the static JSX out to the top of the file: `const ICON = <svg>...</svg>`, so it isn't rebuilt on every render

**Docs:** https://www.react.doctor/docs/rules/react-doctor/rendering-hoist-jsx

**Where:**
- `src/features/venues/NearbyScreen.tsx:398`

### `rerender-state-only-in-handlers` — State only used in handlers (×1)

**What:** Each update to "history" redraws your component for nothing because this useState is set but never shown on screen.

**How to fix:** Use useRef instead of useState when the value is only set and never shown on screen. `ref.current = ...` updates it without redrawing the component.

**Docs:** https://www.react.doctor/docs/rules/react-doctor/rerender-state-only-in-handlers

**Where:**
- `src/App.tsx:83`

## Maintainability

### `design-no-redundant-size-axes` — Redundant width and height axes (×8)

**What:** w-[22px] & h-[22px] are the same.

**How to fix:** Collapse `w-N h-N` to `size-N` (Tailwind v3.4+) when both sides match.

**Docs:** https://www.react.doctor/docs/rules/react-doctor/design-no-redundant-size-axes

**Where:**
- `src/features/venues/CourtDetailsScreen.tsx:217`
- `src/features/venues/NearbyScreen.tsx:689`
- `src/features/auth/OnboardingScreen.tsx:68`
- `src/features/auth/OnboardingScreen.tsx:87`
- `src/features/auth/OnboardingScreen.tsx:143`
- `src/features/profile/EditProfileScreen.tsx:73`
- `src/features/profile/EditProfileScreen.tsx:82`
- `src/features/profile/EditProfileScreen.tsx:145`

### `no-giant-component` — Component is too large (×1)

**What:** Component "NearbyScreen" is 565 lines long, which is hard to read & change. Split it into a few smaller components.

**How to fix:** Pull each section into its own component, like `<UserHeader />` and `<UserActions />`.

**Docs:** https://www.react.doctor/docs/rules/react-doctor/no-giant-component

**Where:**
- `src/features/venues/NearbyScreen.tsx:157`

### `no-render-in-render` — Component rendered by inline function call (×1)

**What:** Your users lose state because "renderScreen()" builds UI from an inline call that React remounts, so pull it into its own component instead.

**How to fix:** Make it a named component, like `const ListItem = ({ item }) => <div>{item.name}</div>`.

**Docs:** https://www.react.doctor/docs/rules/react-doctor/no-render-in-render

**Where:**
- `src/App.tsx:266`

### `design-no-em-dash-in-jsx-text` — Em dash in JSX text (×1)

**What:** Em dash (—) in UI text reads like AI output to your users.

**How to fix:** Replace em dashes in UI text with commas, colons, semicolons, or parentheses so the copy reads less like AI output.

**Docs:** https://www.react.doctor/docs/rules/react-doctor/design-no-em-dash-in-jsx-text

**Where:**
- `src/features/auth/OnboardingScreen.tsx:147`

