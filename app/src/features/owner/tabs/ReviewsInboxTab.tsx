import { useEffect, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { OwnerSection } from '../components/OwnerSection';
import {
  getReviews,
  createReviewReply,
  updateReviewReply,
  deleteReviewReply,
  entityId,
  ApiError,
  type OwnerReview,
  type OwnerReviews,
} from '../../../shared/lib/api';

interface ReviewsInboxTabProps {
  venueId: string;
}

// Filled gold stars for the rating; remaining stars sit in the faint surface tone.
function Stars({ rating = 0, size = 16 }: { rating?: number; size?: number }) {
  const filled = Math.round(rating);
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name="star" size={size} className={n <= filled ? 'text-[var(--star)]' : 'text-[var(--surface-3)]'} />
      ))}
    </span>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-05-04" → "May 4, 2026"; anything we can't parse passes through as-is.
function formatVisitDate(s?: string | null): string {
  if (!s) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  const mi = Number(m[2]) - 1;
  if (mi < 0 || mi > 11) return s;
  return `${MONTHS[mi]} ${Number(m[3])}, ${m[1]}`;
}

// The reviews list doesn't embed replies yet, so reply state starts unknown and
// becomes known after the owner acts (or hits a 409 = a reply already exists).
function ReviewCard({ review }: { review: OwnerReview }) {
  const id = entityId(review);
  const [text, setText] = useState('');
  const [posted, setPosted] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle');

  const submit = async () => {
    if (!text.trim()) return;
    setState('saving');
    try {
      if (conflict) await updateReviewReply(id, text.trim());
      else await createReviewReply(id, text.trim());
      setPosted(text.trim());
      setText('');
      setConflict(false);
      setState('idle');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflict(true);
        setState('idle');
      } else {
        setState('error');
      }
    }
  };

  const removeReply = async () => {
    setState('saving');
    try {
      await deleteReviewReply(id);
      setPosted(null);
      setConflict(false);
      setState('idle');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="rounded-2xl border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Stars rating={review.rating} />
          <span className="font-heading font-semibold text-[14px] leading-none text-[var(--ink)] tabular-nums">
            {Number(review.rating).toFixed(1)}
          </span>
        </div>
        {review.visitDate && <span className="t-eyebrow shrink-0">{formatVisitDate(review.visitDate)}</span>}
      </div>

      {review.text && <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--ink-2)]">{review.text}</p>}
      {review.status && review.status !== 'approved' && (
        <span className="mt-2.5 inline-block rounded-full bg-[var(--surface-2)] px-2 py-0.5 t-eyebrow">{review.status}</span>
      )}

      {posted ? (
        <div className="mt-3 rounded-xl bg-[var(--primary-tint)] p-3">
          <div className="t-eyebrow flex items-center gap-1 text-[var(--primary)]">
            <Icon name="message" size={13} /> Your reply
          </div>
          <p className="mt-1 text-[14px] leading-relaxed text-[var(--ink)]">{posted}</p>
          <div className="mt-2.5 flex gap-4">
            <button type="button" onClick={() => { setText(posted); setConflict(true); setPosted(null); }} className="text-[12px] font-bold text-[var(--primary)]">Edit</button>
            <button type="button" onClick={removeReply} className="text-[12px] font-bold text-[var(--coral)]">Delete</button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <textarea className="control" rows={2} value={text} maxLength={5000} onChange={(e) => setText(e.target.value)} placeholder="Write a reply…" />
          {conflict && <div className="mt-1 t-sm">A reply already exists for this review — saving will update it.</div>}
          <div className="mt-2.5 flex items-center gap-3">
            <button type="button" onClick={submit} disabled={!text.trim() || state === 'saving'} className="h-10 px-5 rounded-full bg-[var(--primary)] text-white font-bold text-[13px] disabled:opacity-50 active:scale-[0.97] transition-transform">
              {state === 'saving' ? 'Saving…' : conflict ? 'Update reply' : 'Post reply'}
            </button>
            {state === 'error' && <span className="t-sm text-[var(--coral)] font-bold">Couldn't save. Try again.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// A polished rating summary: the average in big type beside its gold stars and a
// review-count caption — replaces the two flat "0 / 0" stat tiles.
function RatingSummary({ rating, count, loading }: { rating: number | null; count: number; loading: boolean }) {
  const hasRating = !loading && rating != null && count > 0;
  return (
    <div className="card p-4 flex items-center gap-4">
      <span className="w-12 h-12 rounded-2xl bg-[var(--star-soft)] text-[var(--star-ink)] flex items-center justify-center shrink-0">
        <Icon name="star" size={24} className="text-[var(--star)]" />
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="font-heading font-semibold text-[30px] leading-none text-[var(--ink)] tabular-nums">
          {loading ? '—' : hasRating ? rating!.toFixed(1) : '—'}
        </span>
        <span className="t-eyebrow">/ 5</span>
      </div>
      <div className="min-w-0 ml-auto text-right">
        <Stars rating={hasRating ? rating! : 0} size={18} />
        <div className="t-sm mt-1.5">
          {loading ? 'Loading…' : count > 0 ? `${count} review${count === 1 ? '' : 's'}` : 'No reviews yet'}
        </div>
      </div>
    </div>
  );
}

export function ReviewsInboxTab({ venueId }: ReviewsInboxTabProps) {
  const [data, setData] = useState<OwnerReviews>({ items: [], rating: null, count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!venueId) return;
    let cancelled = false;
    getReviews(venueId)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [venueId]);

  return (
    <div className="space-y-4">
      <RatingSummary rating={data.rating} count={data.count} loading={loading} />

      <OwnerSection title="Reviews" icon="star" description="Reply to build trust. One reply per review.">
        {error ? (
          <div className="t-sm text-[var(--coral)]">Couldn't load reviews.</div>
        ) : loading ? (
          <div className="t-sm">Loading reviews…</div>
        ) : data.items.length === 0 ? (
          <div className="rounded-xl bg-[var(--surface-2)] px-4 py-6 text-center t-sm">No reviews yet.</div>
        ) : (
          <div className="space-y-3">
            {data.items.map((r) => (
              <ReviewCard key={entityId(r)} review={r} />
            ))}
          </div>
        )}
      </OwnerSection>
    </div>
  );
}
