# UX Patterns — Pickleheads-Inspired

## Navigation Pattern
- **Bottom tab bar**: 5 tabs — Home, Nearby, Games, Clubs, Profile
- **Top bar**: Logo (left), Search, Notifications bell, Chat icon (right)
- **FAB**: "+" button on Home and Games tabs for creation actions
- **Screen transitions**: Push right for details, slide up for modals/sheets

## Card Pattern
Every list item is a card with:
- White or pale-blue surface
- Soft shadow (`0 2px 10px rgba(31,42,51,0.06)`)
- Rounded corners (16-20px)
- Clear title, subtitle, metadata row, and one primary action

## Filter Pattern
- Bottom sheet overlay (slides up)
- Title + close button
- Categorized sections with toggles/chips/sliders
- Footer: "Clear" + "Apply" or "View N Results"

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

## Detail Screen Pattern
- Back button (top left)
- Tabs under header (Details | Players | Chat)
- Scrollable content area
- Sticky bottom action bar (for join/leave/invite actions)

## Creation Flow Pattern
- Wizard for multi-step (clubs)
- Single form for simple (games)
- Success modal → immediate "Invite" prompt
- "Maybe later" escape hatch

## Onboarding Pattern
- Checklist on Home screen (not a separate wizard)
- Each item: icon + label + completion state
- Progress indicator (N of M complete)
- "Hide this checklist" option
- All steps individually skippable
