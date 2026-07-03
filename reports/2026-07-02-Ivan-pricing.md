# Ivan Report — 2026-07-02: Owner Pricing Override Tool

## What is this?

The Pricing page (`/owner/pricing`) is a visual grid tool where venue owners paint time blocks with pricing rules. Think of it like a spreadsheet — days as rows, hours as columns — and each colored cell is a price for that hour. The owner paints the grid, saves, and those prices apply to court bookings.

---

## Feature Breakdown

### 1. Venue & Court Picker

At the top of the page, the owner picks which venue to work on (dropdown of all their venues), then optionally narrows to one specific court. When "All courts" is selected, the prices painted apply venue-wide. When a specific court is selected, the prices apply only to that court.

The selected venue is remembered across page visits (saved in the browser).

### 2. Pricing Rules (the paint colors)

Each rule is a color + name + price per hour. The page comes with four defaults (Peak ₱350, Weekend Prime ₱450, Holiday Special ₱500, Early Bird ₱150), but the owner can:

- **Add** a new rule (name, paint label, price, pick a color from 14 swatches)
- **Edit** any rule
- **Delete** a rule (cells painted with it get reassigned to a matching-price rule, or cleared)

Rules are the "paint buckets" — the owner picks a rule from the toolbar, then clicks/drags on the grid to apply it.

### 3. Paint Toolbar

Below the header, a row of buttons shows every active rule plus a "Closed/Clear" eraser. The owner clicks a rule to select it as the active paint color, then clicks or drags on the grid to paint cells with that rule's price. Clicking the "Closed/Clear" tool erases cells (marks them as closed — no bookings, no charge).

### 4. 24-Hour Weekly Grid

The main work area is a grid:
- **7 rows** (Mon–Sun)
- **24 columns** (12AM–11PM)
- Each cell is a colored block representing the price for that day+hour

The owner can:
- **Click** a single cell to paint it
- **Click the day label** (e.g. "Mon") to paint the entire row in one shot
- **Click the hour label** (e.g. "6PM") to paint that hour across all days
- **Drag** across cells to paint a continuous block
- **Hover** on any cell to see a tooltip showing the rule name and price

The grid scrolls horizontally (24 columns is wide — 1414px).

### 5. Schedule Window (Week & Month Navigation)

The grid shows one week at a time. The owner picks:
- **Month** (January–December)
- **Week** (1–5, showing the date range like "Jun 30 – Jul 6")

This lets the owner set prices weeks or months ahead. When they switch weeks, the grid loads any previously-saved prices for that week.

If the current week has unsaved changes, a warning appears: "Save before switching weeks."

### 6. Save to Backend

The "Save Schedule" button writes all painted cells to the server as **slot price overrides**. These are the highest-priority prices — they beat the hourly rate, weekend rate, holiday rate, and default rate.

The save:
- Deletes all existing overrides for that week+court scope
- Creates new overrides from the painted grid cells
- Groups consecutive hours with the same price into a single block (e.g. 6PM–9PM at ₱350, not three separate hour entries)
- Shows "Saved ✓" on success, or the error message on failure

### 7. Summary Panel (Collapsible)

Below the grid, a collapsible "Pricing Summary" shows, for each court and each week, exactly which time blocks have which prices. Court-specific overrides that match the "All courts" pricing are hidden (they're redundant — the court inherits the venue-wide rate). Courts with no custom pricing show "Uses venue-wide pricing."

### 8. Metrics Bar

Three stat cards sit above the grid:
- **Paid Hours / Week** — how many painted (non-closed) hours in the current week
- **Weekly Revenue Estimate** — sum of all painted hours × their prices (rough estimate of one booking per hour)
- **Pricing Rules** — how many rules are defined

### 9. Price Precedence (How Courts Resolve Their Rate)

When a player books a court, the system checks prices in this order:

| Priority | Where Set | What |
|---|---|---|
| 1 (highest) | **Pricing page** (this tool) | Slot override — specific date+time+court price |
| 2 | **Hours tab** | Time-block rate per day+hour |
| 3 | **Listing tab** | Holiday rate |
| 4 | **Listing tab** | Weekend rate |
| 5 | **Courts tab** | Court's own hourly rate |
| 6 (fallback) | **Listing tab** | Venue default hourly rate |

The Pricing page creates priority-1 overrides — they always win.

### 10. Auto Pricing (Separate Feature — SlotPricingTab)

On the venue editor's Pricing tab, there's also an **auto pricing** toggle (separate from this grid tool). When enabled, the system runs nightly and automatically adjusts prices based on demand (occupancy, waitlists, empty slots). The owner sets:
- A minimum confidence level (High/Medium/Low)
- A maximum adjustment cap (5–50%)

Auto-applied prices show up in the same override list and can be manually adjusted or deleted.

---

## Files Involved

| File | What |
|---|---|
| `app/src/features/owner/OwnerPricingScreen.tsx` | Main pricing grid page (869 lines) |
| `app/src/features/owner/tabs/SlotPricingTab.tsx` | Manual surge-pricing form + auto-pricing toggle |
| `app/src/features/owner/tabs/ListingEditorTab.tsx` | Venue default pricing fields |
| `api/src/features/demand/demand.controller.ts` | Auto-pricing engine (nightly cron) |
| `api/src/features/venues/venues.model.ts` | SlotPriceOverride model + auto-pricing fields |
