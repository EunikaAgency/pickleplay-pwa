import { describe, it, expect } from 'vitest';
import { parseTimeLabel } from './gameTime.js';

describe('parseTimeLabel', () => {
  it('converts a 12-hour label to sortable 24h', () => {
    expect(parseTimeLabel('6:30 PM')).toBe('18:30');
    expect(parseTimeLabel('6:30 AM')).toBe('06:30');
    expect(parseTimeLabel('9 AM')).toBe('09:00');
  });

  it('handles the midnight/noon edges', () => {
    expect(parseTimeLabel('12:00 AM')).toBe('00:00');
    expect(parseTimeLabel('12:00 PM')).toBe('12:00');
  });

  it('passes 24-hour input through', () => {
    expect(parseTimeLabel('18:30')).toBe('18:30');
    expect(parseTimeLabel('07:05')).toBe('07:05');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(parseTimeLabel('  6:30pm ')).toBe('18:30');
  });

  // The backfill relies on null meaning "unknown" — never midnight. A game whose
  // timeLabel is a mood ('Tonight') must not be silently scheduled for 00:00.
  it('returns null for labels that carry no time', () => {
    expect(parseTimeLabel('Tonight')).toBeNull();
    expect(parseTimeLabel('')).toBeNull();
    expect(parseTimeLabel(undefined)).toBeNull();
    expect(parseTimeLabel(null)).toBeNull();
  });

  it('rejects out-of-range values rather than coercing them', () => {
    expect(parseTimeLabel('25:00')).toBeNull();
    expect(parseTimeLabel('10:75')).toBeNull();
    expect(parseTimeLabel('13:00 PM')).toBeNull();
    expect(parseTimeLabel('0:30 AM')).toBeNull();
  });
});
