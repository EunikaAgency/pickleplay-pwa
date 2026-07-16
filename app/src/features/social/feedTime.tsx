import type { ReactNode } from 'react';

/** "2h" / "3d" / "Jun 8" from an ISO string. Shared by the feed card, quote, and permalink. */
export function relTime(iso?: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.round((Date.now() - t) / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Matches URLs with an optional https?:// prefix so bare domains like
// "eunika.agency" also become links. Fragments like trailing punctuation
// (.,;:) are excluded from the href.
const URL_RE = /https?:\/\/[^\s<]+|[^\s<]+\.[a-z]{2,}(\/[^\s<.,;:!?]*)?/gi;

/** Wrap URLs in `text` as tappable `<a>` elements; everything else stays plain. */
export function linkifyBody(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    let href = m[0];
    if (!/^https?:\/\//i.test(href)) href = `https://${href}`;
    parts.push(
      <a key={m.index} href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--blue)] underline font-medium break-all" onClick={(e) => e.stopPropagation()}>
        {m[0]}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
}
