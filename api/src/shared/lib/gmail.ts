// Gmail API OAuth 2.0 mailer — sends email via the Gmail REST API using a
// stored refresh token. Tokens are persisted to a local JSON file (single-
// server, no Redis yet).
//
// Setup flow:
//   1. GET /api/v1/auth/gmail-oauth-url → visit the URL, grant consent
//   2. Google redirects to /api/v1/auth/gmail-callback?code=...
//   3. The callback exchanges the code for tokens and stores the refresh token.
//
// Once a valid refresh token is stored, sendEmail() is available.

import { google } from 'googleapis';
import fs from 'node:fs';
import path from 'node:path';

const TOKEN_PATH = path.resolve(import.meta.dirname, '../../..', '.gmail-tokens.json');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI_DEV || 'http://localhost:9002/api/v1/auth/gmail-callback';

interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  scope: string;
  token_type: string;
  email?: string;
}

function loadTokens(): StoredTokens | null {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    }
  } catch { /* corrupt or missing — start fresh */ }
  return null;
}

function saveTokens(tokens: StoredTokens): void {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

export function getStoredTokens(): StoredTokens | null {
  return loadTokens();
}

export function isGmailConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET);
}

export function hasValidTokens(): boolean {
  const tokens = loadTokens();
  if (!tokens?.refresh_token) return false;
  // If the access token hasn't expired yet, we're good.
  if (tokens.expiry_date && tokens.expiry_date > Date.now() + 60_000) return true;
  // We have a refresh token — we can get a new access token on demand.
  return true;
}

/** Build the Google OAuth consent URL. */
export function getOAuthUrl(): string {
  if (!CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID is not set');

  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',         // return a refresh token
    prompt: 'consent',              // force refresh token every time
    scope: 'https://www.googleapis.com/auth/gmail.send',
  });
}

/** Exchange an authorization code for tokens and persist them. */
export async function exchangeCode(code: string): Promise<{ email?: string }> {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('Google OAuth credentials not configured');

  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    // The refresh token is only returned on the first consent. If the user
    // already granted access, revoke first or add prompt=consent (which we do).
    throw new Error('No refresh token returned. Revoke the app at https://myaccount.google.com/permissions and try again.');
  }

  // Fetch the email address associated with the token.
  oauth2Client.setCredentials(tokens);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  let email: string | undefined;
  try {
    const profile = await gmail.users.getProfile({ userId: 'me' });
    email = profile.data.emailAddress ?? undefined;
  } catch { /* non-critical */ }

  const stored: StoredTokens = {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date ?? Date.now() + 3600_000,
    scope: tokens.scope ?? 'https://www.googleapis.com/auth/gmail.send',
    token_type: tokens.token_type ?? 'Bearer',
    email,
  };

  saveTokens(stored);
  return { email };
}

/** Get an authenticated Gmail client, refreshing the access token if needed. */
async function getGmailClient(): Promise<ReturnType<typeof google.gmail>> {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('Google OAuth credentials not configured');

  const stored = loadTokens();
  if (!stored?.refresh_token) throw new Error('Gmail not authorized — visit /api/v1/auth/gmail-oauth-url first');

  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  oauth2Client.setCredentials({
    refresh_token: stored.refresh_token,
    access_token: stored.access_token,
    expiry_date: stored.expiry_date,
  });

  // Refresh if expired or about to expire.
  if (!stored.expiry_date || stored.expiry_date < Date.now() + 60_000) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      stored.access_token = credentials.access_token!;
      stored.expiry_date = credentials.expiry_date ?? Date.now() + 3600_000;
      saveTokens(stored);
      oauth2Client.setCredentials({
        refresh_token: stored.refresh_token,
        access_token: stored.access_token,
        expiry_date: stored.expiry_date,
      });
    } catch (err) {
      throw new Error(`Failed to refresh Gmail token: ${(err as Error).message}`);
    }
  }

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/** Build a raw RFC 2822 MIME message string. */
function buildRawMessage(opts: {
  from: string; to: string; subject: string; body: string; html?: string;
}): string {
  const subjectB64 = Buffer.from(opts.subject).toString('base64');
  const wrap76 = (s: string) => s.replace(/(.{76})/g, '$1\r\n');

  if (opts.html) {
    const boundary = `====boundary_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const textB64 = wrap76(Buffer.from(opts.body, 'utf-8').toString('base64'));
    const htmlB64 = wrap76(Buffer.from(opts.html, 'utf-8').toString('base64'));
    return [
      `From: ${opts.from}`,
      `To: ${opts.to}`,
      `Subject: =?UTF-8?B?${subjectB64}?=`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      textB64,
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      htmlB64,
      `--${boundary}--`,
    ].join('\r\n');
  }

  return [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: =?UTF-8?B?${subjectB64}?=`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    opts.body,
  ].join('\r\n');
}

/** Send an email via the Gmail API. Set opts.html for a rich HTML email;
 *  the plain-text body is always included as the multipart/alternative fallback.
 *  Pass opts.userInfo (e.g. "Juan Dela Cruz - player") to enrich the monitoring
 *  copy subject when email monitoring is enabled in admin settings. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  body: string;
  html?: string;
  from?: string;
  userInfo?: string;
}): Promise<{ messageId: string }> {
  const gmail = await getGmailClient();

  const from = opts.from || process.env.EMAIL_FROM || 'Pickleballers <noreply@pickleballer.eunika.xyz>';

  const raw = buildRawMessage({ from, to: opts.to, subject: opts.subject, body: opts.body, html: opts.html });
  const encoded = Buffer.from(raw).toString('base64url');

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  });

  // Send a separate monitoring copy with an enriched subject.
  try {
    const { getEmailBcc } = await import('../../features/settings/settings.controller.js');
    const bcc = await getEmailBcc();
    if (bcc?.enabled && bcc.address && bcc.address !== opts.to) {
      const monitorSubject = opts.userInfo
        ? `[${opts.userInfo}] ${opts.subject}`
        : opts.subject;
      const monitorRaw = buildRawMessage({ from, to: bcc.address, subject: monitorSubject, body: opts.body, html: opts.html });
      const monitorEncoded = Buffer.from(monitorRaw).toString('base64url');
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: monitorEncoded },
      });
    }
  } catch (err) { console.error('[sendEmail] monitoring copy failed:', (err as Error).message); }

  return { messageId: res.data.id ?? 'unknown' };
}
