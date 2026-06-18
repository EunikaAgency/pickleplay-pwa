import { useEffect, useState } from 'react';
import { Button } from '../../../shared/components/ui/Button';
import { FormField } from '../../../shared/components/forms/FormField';
import { FormSelect } from '../../../shared/components/forms/FormSelect';
import {
  getTournamentAnnouncements, sendTournamentAnnouncement, type ApiAnnouncement,
} from '../../../shared/lib/api';
import { prettyDate } from '../organizerDisplay';

type Kind = 'general' | 'schedule' | 'venue';

const KIND_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'schedule', label: 'Schedule change' },
  { value: 'venue', label: 'Venue change' },
];

/** Compose + broadcast an announcement to every registrant, plus the feed of
 *  what's already gone out. Used inside the tournament detail screen. */
export function AnnouncementsPanel({ tournamentId }: { tournamentId: string }) {
  const [feed, setFeed] = useState<ApiAnnouncement[]>([]);
  const [kind, setKind] = useState<Kind>('general');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    getTournamentAnnouncements(tournamentId)
      .then((a) => { if (alive) setFeed(a); })
      .catch(() => { if (alive) setFeed([]); });
    return () => { alive = false; };
  }, [tournamentId, reloadKey]);

  const send = async () => {
    if (!title.trim() || !body.trim() || sending) return;
    setSending(true);
    setNotice(null);
    try {
      const res = await sendTournamentAnnouncement(tournamentId, { title: title.trim(), body: body.trim(), kind });
      setNotice(`Sent to ${res?.recipientCount ?? 0} player${res?.recipientCount === 1 ? '' : 's'} ✓`);
      setTitle(''); setBody('');
      setReloadKey((k) => k + 1);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not send the announcement.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <FormSelect label="Type" value={kind} onChange={(e) => setKind(e.target.value as Kind)} options={KIND_OPTIONS} />
      <FormField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Day 2 matches moved" />
      <FormField label="Message" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Due to rain, Sunday matches shift to the indoor courts." />
      {notice && <div className="text-[13px] font-semibold text-[var(--primary-deep)]">{notice}</div>}
      <Button fullWidth onClick={send} disabled={sending || !title.trim() || !body.trim()}>{sending ? 'Sending…' : 'Send to participants'}</Button>

      {feed.length > 0 && (
        <div className="mt-1 flex flex-col gap-2">
          {feed.map((a) => (
            <div key={a.id} className="rounded-xl bg-[var(--surface-2)] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-heading font-semibold text-[14px] text-[var(--ink)] truncate">{a.title}</div>
                <span className="text-[11px] font-bold text-[var(--muted)] shrink-0">{a.recipientCount} sent</span>
              </div>
              <div className="text-[13px] text-[var(--ink-2)] mt-0.5">{a.body}</div>
              <div className="t-eyebrow mt-1">{a.kind} · {prettyDate(a.createdAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
