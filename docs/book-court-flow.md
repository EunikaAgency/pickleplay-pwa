# Book-a-Court Flow (with open games + split payment)

Status: **design** — the open-game/split branch is not built yet. The simple
**private-reservation branch IS built** (see "What's built" below). Supersedes
the hand-drawn flow. Builds on the existing `api/` slices: `bookings/`,
`payments/` (`Payment` + `VenuePricing`), `games/`, and the `owner/` console.

## What's built (2026-06-04) — the simple booking branch

The private-reservation path is live in the PWA: **pick court → date/time →
see cost → pay (test-mode checkout) → confirmed**, plus a My-bookings list with
cancel. Decisions baked in:

- **Require a price** — only venues with a `priceFrom` rate are bookable.
- **Cost** = `priceFrom × hours`, shown before commitment.
- **Server-backed test mode** — a new `AppSettings` singleton (`GET /settings`
  public, `PATCH /settings` admin via `admin.settings.manage`) holds
  `paymentTestMode` (default **on**). `POST /api/v1/payments/checkout` reads it:
  in **test mode** it creates a completed `Payment` and flips the booking to
  `confirmed` (no charge); in **live mode** it records a pending payment and the
  booking stays `pending_approval` (future real-gateway seam).
- Gated by the new `player.bookings.create` permission.

Still TODO (follow-up, see bottom): point the **web** admin toggle
(`AdminSettingsPage.jsx`, currently localStorage-only) and web `CheckoutPage.jsx`
at the new endpoints so the website honours the same server flag.

## Payments & settlement (escrow model)

Money flows **to the platform first**, not straight to the venue. The platform
holds funds and settles to each venue **after the session** (or on a periodic —
e.g. monthly — payout / revenue cycle). This is what lets refunds, the
all-or-nothing split, and cancellations work without clawing back money already
in a venue's account. Net of any cancellation deductions, the venue is paid out
on the settlement cycle. (Gateway choice is still TBD; test mode charges no one.)

## Money-state ladder (the spine of the whole thing)

Money only exists in the last state. Every transition has a **deadline** and a
**"falls through → reopen or dissolve"** escape.

```
tentative hold  →  divisor locked  →  paid / booked
(open lobby,        (confirm + pay     (refund rules +
 bump-able)          window, slot       free-cancel
                     locked)            window apply)
```

## Full flow

```mermaid
flowchart TD
    A[Find venue] --> B[Choose court / schedule]
    B --> B1[/Show rate × duration = TOTAL cost/]
    B1 --> C{Slot free?}
    C -- No --> C1[Suggest other times] --> B
    C -- Yes --> D{Create a game?}

    %% ---- Private reservation branch ----
    D -- "No (private)" --> P1[Lock slot for payment\n10-min hold timeout]
    P1 --> P2{Paid in time?}
    P2 -- No --> P3[Release hold] --> B
    P2 -- Yes --> BOOKED([Court booked])

    %% ---- Open game branch ----
    D -- Yes --> G1[Set format: OPEN or FIXED/doubles\ncapacity · host: split vs cover-whole]
    G1 --> G2[Open lobby — TENTATIVE hold\nslot still bump-able]
    G2 --> J{Players joining}

    %% bump by a paying private booking
    G2 -. "private booker pays this slot" .-> BUMP[Bumped: notify host + joiners\n→ suggest other lobbies / make own reservation]

    J --> CONF{Ready to book?\nFIXED: count hits N\nOPEN: host taps Book now, or deadline}
    CONF -- "deadline, too few" --> DIS1[Auto-cancel · release slot\nno charge · suggest other lobbies]
    CONF -- Ready --> HC{Host confirms?\ncountdown}
    HC -- "deadline passes" --> DIS1
    HC -- Confirms --> LOCK[DIVISOR LOCKS\nslot locked vs bumping]

    LOCK --> PAY[All-or-nothing pay window\nevery player incl host: confirm & pay share]
    PAY --> PAYOK{Everyone confirmed\nin the window?}
    PAYOK -- "no — someone failed/ghosted" --> DROP[Drop that player · NO money moved]
    DROP --> REOPEN
    PAYOK -- Yes --> CAP[Atomic capture] --> BOOKED2([Court booked · game confirmed])

    %% ---- After paid: cancellations ----
    BOOKED2 --> X{Something changes?}
    X -- "venue cancels" --> RV[Full refund all]
    X -- "host or joiner backs out" --> BO[Refund backer-outer\ndeduction by free-cancel window]
    BO --> REOPEN{Ask remaining: re-open?}
    REOPEN -- "≥1 says Yes" --> RH[Opt-ins stay · opt-outs refunded\nif host left, a Yes player becomes new host]
    RH --> J
    REOPEN -- "all say No" --> DIS2[Dissolve · everyone already refunded]
```

## Rules that make the branches unambiguous

| Decision | Rule |
|---|---|
| **Total cost shown** | At *Choose court/schedule* — `rate × duration`. Host can bail to another court here. |
| **Split** | Always `total ÷ players-in-lobby`. Host may instead choose **cover-whole**. |
| **Min players** | OPEN: still needs **≥2** (can't play alone). FIXED (doubles): exactly 4 or it cancels. |
| **Price lock** | Locks at **host-confirm**. Backfillers pay open shares; people who stayed are never re-charged. |
| **No money until confirm** | Nothing is captured before host-confirm + everyone's pay-confirm (all-or-nothing). |
| **Bump priority** | A **paid** booking beats a **tentative** open lobby. Once a slot is locked (private payment OR open pay-window), it can't be bumped. |
| **Free-cancel window** | Free cancel > X hrs before play; **deduction** after (court's about to go to waste). |
| **Reopen on backout** | Survives if **≥1** remaining player opts in; dissolves only if **all** opt out. |
| **Host transfer** | If the host backs out and the lobby reopens, an opt-in player becomes the **new host**. |

## Permission

New capability ⇒ new permission per repo convention:
`player.bookings.create` — gate the screen + the `POST /bookings` route, add to
the three synced `permissions` copies + `PERMISSION_CATALOGUE` + role defaults.
```
