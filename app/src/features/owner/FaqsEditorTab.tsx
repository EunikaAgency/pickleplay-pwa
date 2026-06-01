import { useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { OwnerSection } from './OwnerSection';
import {
  listFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
  entityId,
  type OwnerFaq,
} from '../../shared/lib/api';

interface FaqsEditorTabProps {
  venueId: string;
}

function FaqRow({ faq, onSaved, onDeleted }: { faq: OwnerFaq; onSaved: (f: OwnerFaq) => void; onDeleted: (id: string) => void }) {
  const id = entityId(faq);
  const [question, setQuestion] = useState(faq.question || '');
  const [answer, setAnswer] = useState(faq.answer || '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [busy, setBusy] = useState(false);

  const dirty = question !== (faq.question || '') || answer !== (faq.answer || '');

  const save = async () => {
    if (!question.trim() || !answer.trim()) return;
    setStatus('saving');
    try {
      const updated = await updateFaq(id, { question, answer });
      setStatus('saved');
      onSaved(updated);
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1800);
    } catch {
      setStatus('error');
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteFaq(id);
      onDeleted(id);
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border-[0.5px] border-[var(--hairline)] p-4 space-y-3">
      <div className="field p-0!">
        <label className="lbl">Question</label>
        <input className="control" value={question} maxLength={2000} onChange={(e) => { setQuestion(e.target.value); setStatus('idle'); }} />
      </div>
      <div className="field p-0!">
        <label className="lbl">Answer</label>
        <textarea className="control" rows={3} value={answer} maxLength={10000} onChange={(e) => { setAnswer(e.target.value); setStatus('idle'); }} />
      </div>
      <div className="flex items-center gap-2">
        {dirty && (
          <button type="button" onClick={save} disabled={status === 'saving'} className="h-10 px-4 rounded-2xl bg-[var(--primary)] text-white font-bold text-[13px] disabled:opacity-60">
            {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save'}
          </button>
        )}
        <div className="flex-1" />
        <button type="button" onClick={remove} disabled={busy} aria-label="Delete FAQ" className="w-10 h-10 rounded-2xl flex items-center justify-center text-[var(--muted)] hover:text-[var(--coral)] disabled:opacity-50">
          <Icon name="close" size={18} />
        </button>
      </div>
      {status === 'error' && <div className="t-sm text-[var(--coral)] font-bold">Couldn't save. Try again.</div>}
    </div>
  );
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
          <div className="space-y-3">
            {faqs.map((f) => (
              <FaqRow key={entityId(f)} faq={f} onSaved={onSaved} onDeleted={onDeleted} />
            ))}
          </div>
        )}
      </OwnerSection>
    </div>
  );
}
