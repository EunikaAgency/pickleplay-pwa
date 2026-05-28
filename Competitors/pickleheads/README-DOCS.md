# PicklePlay Documentation Index

This folder now contains a reverse-engineered documentation set built from the available screenshots.

The goal is to help a new teammate understand:

1. what the product is
2. how users interact with it
3. what screens and flows currently exist
4. where the remaining unknowns are

## Recommended Reading Order

If you are new to the project, read the docs in this order:

1. [PROJECT-OVERVIEW.md](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/PROJECT-OVERVIEW.md)
   - Best first read
   - Explains what the product appears to be, who it serves, its core user journeys, and the overall navigation tree

2. [USER-ORIENTED-GUIDE.md](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/USER-ORIENTED-GUIDE.md)
   - Best second read
   - Explains how a player or organizer likely uses the app in practice

3. [APP-FLOWS.md](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/APP-FLOWS.md)
   - Best for understanding how screens connect
   - Focuses on movement through the product and likely flow transitions

4. [PAGES-MAP.md](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/PAGES-MAP.md)
   - Best detailed reference
   - Documents each screenshot file explicitly, including visible UI, actions, and related screens

5. [screenshot-gallery.html](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/screenshot-gallery.html)
   - Best visual companion
   - Lets you browse grouped screenshots while reading the markdown docs

6. [THEMING.md](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/THEMING.md)
   - Best visual system reference
   - Captures the inferred palette, type direction, spacing, radii, and component styling

## What Each File Is For

### [PROJECT-OVERVIEW.md](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/PROJECT-OVERVIEW.md)

Use this when you want the fastest high-level understanding of the project.

It covers:

- product summary
- main user types
- core product promise
- major feature areas
- top-level navigation tree
- biggest confirmed strengths and remaining unknowns

### [USER-ORIENTED-GUIDE.md](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/USER-ORIENTED-GUIDE.md)

Use this when you want to understand the app as a user experience rather than a screen list.

It covers:

- onboarding
- discovery
- joining games
- creating sessions
- groups
- lists
- chat
- stats
- notifications
- account settings

### [APP-FLOWS.md](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/APP-FLOWS.md)

Use this when you want the route-like or navigation-like view of the app.

It covers:

- high-level app map
- core user flows
- game/session flows
- group and list flows
- competitive play setup flows
- notification and billing flows

### [PAGES-MAP.md](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/PAGES-MAP.md)

Use this when you need exact screenshot-level reference.

It covers:

- every screenshot file currently documented
- exact visible labels and controls
- page purpose
- visible buttons and CTAs
- related screens
- notes on mismatches or uncertainty

### [screenshot-gallery.html](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/screenshot-gallery.html)

Use this when you want a visual browser for the screenshots instead of opening image files manually.

It is useful for:

- side-by-side review
- feature grouping
- quick orientation during meetings
- cross-checking markdown descriptions against visuals

### [THEMING.md](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/THEMING.md)

Use this when you want to translate the screenshots into reusable UI design rules.

It covers:

- inferred brand palette
- neutral palette
- typography direction
- spacing and radius tokens
- button, card, input, and tab styling
- premium and state color usage
- accessibility and implementation notes

## Best Uses By Role

### For a developer

Read:

1. `PROJECT-OVERVIEW.md`
2. `APP-FLOWS.md`
3. `PAGES-MAP.md`

### For a PM or product owner

Read:

1. `PROJECT-OVERVIEW.md`
2. `USER-ORIENTED-GUIDE.md`
3. `APP-FLOWS.md`

### For a designer or UX reviewer

Read:

1. `PROJECT-OVERVIEW.md`
2. `PAGES-MAP.md`
3. `screenshot-gallery.html`

### For anyone doing gap analysis

Read:

1. `PROJECT-OVERVIEW.md`
2. `APP-FLOWS.md`
3. `PAGES-MAP.md`

Then focus on sections marked:

- `needs verification`
- not captured
- unclear downstream flow

## Current Documentation Boundaries

These docs are based on screenshots only.

That means they are strong for:

- current visible UI
- feature grouping
- user-facing behavior
- likely navigation and workflow structure

They are weaker for:

- exact route names
- implementation details
- backend architecture
- API contracts
- hidden states not shown in screenshots

## Short Version

If you only have 10 minutes:

1. read [PROJECT-OVERVIEW.md](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/PROJECT-OVERVIEW.md)
2. skim [APP-FLOWS.md](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/APP-FLOWS.md)
3. open [screenshot-gallery.html](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/screenshot-gallery.html)

If you need the deepest reference, end with [PAGES-MAP.md](c:/Users/admin/Local%20Sites/PicklePlay/pickleheads/PAGES-MAP.md).
