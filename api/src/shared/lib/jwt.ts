// Pickleballers API — JWT Utilities
// Token signing, verification, and user payload extraction.

import { Jwt } from 'hono/utils/jwt';

export interface TokenPayload {
  sub: string;       // user ID
  email: string;
  role: string;
  roles?: string[];
  permissions?: string[];
  // For a staff sub-account: the owner who created it. Resources owned by this
  // id are treated as the staff member's own (see effectiveOwnerId). Absent for
  // every non-staff user.
  parentOwnerId?: string;
  type: 'access' | 'refresh';
}

const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
const SECRET = process.env.JWT_SECRET;

// Enforce a strong JWT secret in production
if (!SECRET || (process.env.NODE_ENV === 'production' && SECRET === 'change-me-in-production-use-a-long-random-string')) {
  throw new Error('JWT_SECRET must be set to a strong, unique value in production');
}

/** Parse a time string like "15m", "7d", "1h" into seconds */
function parseExpiry(time: string): number {
  const match = time.match(/^(\d+)\s*(m|h|d|s)$/);
  if (!match) return 900; // default 15 min
  const val = parseInt(match[1]!);
  switch (match[2]) {
    case 's': return val;
    case 'm': return val * 60;
    case 'h': return val * 3600;
    case 'd': return val * 86400;
    default: return 900;
  }
}

export function signAccessToken(payload: Omit<TokenPayload, 'type'>): Promise<string> {
  return Jwt.sign(
    { ...payload, type: 'access', exp: Math.floor(Date.now() / 1000) + parseExpiry(ACCESS_EXPIRY) },
    SECRET,
    'HS256',
  );
}

export function signRefreshToken(payload: Omit<TokenPayload, 'type'>): Promise<string> {
  return Jwt.sign(
    { ...payload, type: 'refresh', exp: Math.floor(Date.now() / 1000) + parseExpiry(REFRESH_EXPIRY) },
    SECRET,
    'HS256',
  );
}

/** Verify a token and return the decoded payload. Throws on invalid/expired. */
export async function verifyToken(token: string): Promise<TokenPayload> {
  const payload = await Jwt.verify(token, SECRET, 'HS256');
  return payload as unknown as TokenPayload;
}

/** Decode a token without verifying (for reading expiry, etc.) */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const { payload } = Jwt.decode(token);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}
