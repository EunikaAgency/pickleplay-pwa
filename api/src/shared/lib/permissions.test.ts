// Guard for workstream D (#9): the 16 Jul meeting ruled venue STAFF must not see
// revenue. Staff previously held `owner.analytics.view` (the per-venue revenue +
// occupancy view); it has been withheld. This pins the split so a future edit to
// the role map can't silently re-expose revenue to staff.
import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS } from './permissions.js';

describe('staff revenue visibility', () => {
  it('staff does NOT hold owner.analytics.view (no per-venue revenue)', () => {
    expect(ROLE_PERMISSIONS.staff).not.toContain('owner.analytics.view');
  });

  it('owner STILL holds owner.analytics.view', () => {
    expect(ROLE_PERMISSIONS.owner).toContain('owner.analytics.view');
  });

  it('staff remains denied the other five owner-only keys', () => {
    for (const key of ['owner.reports.view', 'owner.pricing.manage', 'owner.staff.manage', 'owner.venues.create', 'owner.venues.claim'] as const) {
      expect(ROLE_PERMISSIONS.staff).not.toContain(key);
    }
  });

  it('staff keeps its operational owner keys (still runs the front desk)', () => {
    expect(ROLE_PERMISSIONS.staff).toContain('owner.access');
    expect(ROLE_PERMISSIONS.staff).toContain('owner.bookings.manage');
    expect(ROLE_PERMISSIONS.staff).toContain('owner.venues.manage');
  });
});
