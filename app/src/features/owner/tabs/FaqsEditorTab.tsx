import { useEffect, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { OwnerSection } from '../components/OwnerSection';
import {
  listFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
  entityId,
  type OwnerFaq,
} from '../../../shared/lib/api';

interface FaqsEditorTabProps {
  venueId: string;
}

export function FaqsEditorTab({ venueId }: FaqsEditorTabProps) {
  const [faqs, setFaqs] = useState<OwnerFaq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [q, setQ] = useState('');
  const [a, setA] = useState('');
  const [addStatus, setAddStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  useEffect(() => {
    if (!venueId) return;
    let cancelled = false;
    listFaqs(venueId)
      .then((d) => {
        if (cancelled) return;
        setFaqs(d);
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

  const onAdd = async () => {
    if (!q.trim() || !a.trim()) return;
    setAddStatus('saving');
    try {
      const created = await createFaq(venueId, { question: q.trim(), answer: a.trim(), sortOrder: faqs.length });
      setFaqs((list) => [...list, created]);
      setQ('');
      setA('');
      setAddStatus('idle');
    } catch {
      setAddStatus('error');
    }
  };

  const onSaved = (updated: OwnerFaq) => setFaqs((list) => list.map((f) => (entityId(f) === entityId(updated) ? { ...f, ...updated } : f)));
  const onDeleted = (id: string) => setFaqs((list) => list.filter((f) => entityId(f) !== id));

  return (
    <div className="space-y-4">
      <OwnerSection title="Add a FAQ" icon="plus" description="Answer the questions players ask most.">
        <div className="space-y-3">
          <div className="field p-0!">
            <label className="lbl">Question</label>
            <input className="control" value={q} maxLength={2000} onChange={(e) => setQ(e.target.value)} placeholder="Do you rent paddles?" />
          </div>
          <div className="field p-0!">
            <label className="lbl">Answer</label>
            <textarea className="control" rows={3} value={a} maxLength={10000} onChange={(e) => setA(e.target.value)} />
          </div>
          <button type="button" onClick={onAdd} disabled={!q.trim() || !a.trim() || addStatus === 'saving'} className="h-12 px-5 rounded-2xl bg-[var(--primary)] text-white font-heading font-semibold text-[15px] disabled:opacity-60">
            {addStatus === 'saving' ? 'Adding…' : 'Add FAQ'}
          </button>
          {addStatus === 'error' && <div className="t-sm text-[var(--coral)] font-bold">Couldn't add. Try again.</div>}
        </div>
      </OwnerSection>

      <OwnerSection title="FAQs" icon="help" description={loading ? 'Loading…' : `${faqs.length} question${faqs.length === 1 ? '' : 's'}`}>
        {error ? (
          <div className="t-sm text-[var(--coral)]">Couldn't load FAQs.</div>
        ) : loading ? (
          <div className="t-sm">Loading FAQs…</div>
        ) : faqs.length === 0 ? (
          <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3 t-sm">No FAQs yet.</div>
        ) : (
          <div className="rounded-2xl border-[0.5px] border-[var(--hairline)] divide-y-[0.5px] divide-[var(--hairline)] overflow-hidden">
            {faqs.map((f) => (
              <details key={entityId(f)} className="group">
                <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none select-none">
                  <span className="font-semibold text-[14px] text-[var(--ink)] flex-1">{f.question}</span>
                  <Icon name="expand_more" size={18} className="text-[var(--muted)] transition-transform group-open:rotate-180 shrink-0" />
                </summary>
                <div className="px-4 pb-3">
                  <p className="text-[14px] text-[var(--ink-2)] leading-relaxed mb-3">{f.answer}</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const q = prompt('Edit question:', f.question);
                        if (q == null) return;
                        const a = prompt('Edit answer:', f.answer);
                        if (a == null) return;
                        updateFaq(entityId(f), { question: q, answer: a }).then((updated) => onSaved(updated)).catch(() => {});
                      }}
                      className="text-[12px] font-bold text-[var(--primary)]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (confirm('Delete this FAQ?')) { deleteFaq(entityId(f)).then(() => onDeleted(entityId(f))).catch(() => {}); } }}
                      className="text-[12px] font-bold text-[var(--coral)]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </OwnerSection>
    </div>
  );
}
