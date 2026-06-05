import { useEffect, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { OwnerStat } from '../components/OwnerStat';
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

function Stars({ rating = 0 }: { rating?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name="star" size={14} className={n <= rating ? 'text-[var(--primary)]' : 'text-[var(--surface-3)]'} />
      ))}
    </span>
  );
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
    <div className="rounded-xl border-[0.5px] border-[var(--hairline)] p-4">
      <div className="flex items-center justify-between gap-3">
        <Stars rating={review.rating} />
        <span className="t-sm">{review.visitDate || ''}</span>
      </div>
      {review.text && <p className="mt-2 text-[14px] text-[var(--ink-2)]">{review.text}</p>}
      {review.status && review.status !== 'approved' && (
        <span className="mt-2 inline-block rounded-full bg-[var(--surface-2)] px-2 py-0.5 t-eyebrow">{review.status}</span>
      )}

      {posted ? (
        <div className="mt-3 rounded-xl bg-[var(--primary-tint)] p-3">
          <div className="t-eyebrow flex items-center gap-1">
            <Icon name="message" size={13} /> Your reply
          </div>
          <p className="mt-1 text-[14px] text-[var(--ink)]">{posted}</p>
          <div className="mt-2 flex gap-4">
            <button type="button" onClick={() => { setText(posted); setConflict(true); setPosted(null); }} className="text-[12px] font-bold text-[var(--primary)]">Edit</button>
            <button type="button" onClick={removeReply} className="text-[12px] font-bold text-[var(--coral)]">Delete</button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <textarea className="control" rows={2} value={text} maxLength={5000} onChange={(e) => setText(e.target.value)} placeholder="Write a reply…" />
          {conflict && <div className="mt-1 t-sm">A reply already exists for this review — saving will update it.</div>}
          <div className="mt-2 flex items-center gap-3">
            <button type="button" onClick={submit} disabled={!text.trim() || state === 'saving'} className="h-10 px-4 rounded-full bg-[var(--primary)] text-white font-bold text-[13px] disabled:opacity-60">
              {state === 'saving' ? 'Saving…' : conflict ? 'Update reply' : 'Post reply'}
            </button>
            {state === 'error' && <span className="t-sm text-[var(--coral)] font-bold">Couldn't save. Try again.</span>}
          </div>
        </div>
      )}
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
      <div className="grid grid-cols-2 gap-3">
        <OwnerStat label="Total reviews" value={loading ? '—' : data.count} icon="star" tone="primary" />
        <OwnerStat label="Average rating" value={data.rating != null ? data.rating : '—'} icon="star" tone="coral" />
      </div>

      <OwnerSection title="Reviews" icon="star" description="Reply to build trust. One reply per review.">
        {error ? (
          <div className="t-sm text-[var(--coral)]">Couldn't load reviews.</div>
        ) : loading ? (
          <div className="t-sm">Loading reviews…</div>
        ) : data.items.length === 0 ? (
          <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3 t-sm">No reviews yet.</div>
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
