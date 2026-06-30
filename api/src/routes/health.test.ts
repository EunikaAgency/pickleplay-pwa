// Pickleballers API — Health Endpoint Tests

import { describe, it, expect } from 'vitest';
import app from '../index.js';

describe('GET /health', () => {
  it('returns ok status', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('timestamp');
  });
});

describe('GET /', () => {
  it('returns API status metadata', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);

    const body = await res.json() as Record<string, unknown>;
    expect(body.name).toBe('pickleballers-api');
    expect(body.status).toBe('ok');
    expect(body.health).toBe('/health');
  });
});

describe('404 handling', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await app.request('/api/v1/nonexistent');
    expect(res.status).toBe(404);
  });
});
