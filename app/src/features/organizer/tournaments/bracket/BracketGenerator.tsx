import { useState } from 'react';
import { Button } from '../../../../shared/components/ui/Button';
import { FormField } from '../../../../shared/components/forms/FormField';
import { FormSelect } from '../../../../shared/components/forms/FormSelect';
import { generateBracket, type BracketFormat, type MatchFormat } from '../../../../shared/lib/api';
import { OrganizerSection } from '../../components/OrganizerSection';

interface BracketGeneratorProps {
  tid: string;
  entrantCount: number;
  /** Defaults pulled from the tournament record. */
  defaultFormat?: BracketFormat;
  defaultMatchFormat?: MatchFormat;
  onGenerated: () => void;
}

const FORMAT_OPTIONS = [
  { value: 'single_elimination', label: 'Single elimination' },
  { value: 'double_elimination', label: 'Double elimination' },
  { value: 'round_robin', label: 'Round robin' },
  { value: 'pool_play', label: 'Pool play' },
];
const MATCH_FORMAT_OPTIONS = [
  { value: 'bo1', label: 'Best of 1' },
  { value: 'bo3', label: 'Best of 3' },
  { value: 'bo5', label: 'Best of 5' },
];

export function BracketGenerator({ tid, entrantCount, defaultFormat, defaultMatchFormat, onGenerated }: BracketGeneratorProps) {
  const [format, setFormat] = useState<BracketFormat>(defaultFormat ?? 'single_elimination');
  const [matchFormat, setMatchFormat] = useState<MatchFormat>(defaultMatchFormat ?? 'bo3');
  const [poolCount, setPoolCount] = useState('2');
  const [advancers, setAdvancers] = useState('2');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      await generateBracket(tid, {
        format,
        matchFormat,
        ...(format === 'pool_play' ? { poolCount: Number(poolCount) || 2, advancersPerPool: Number(advancers) || 2 } : {}),
      });
      onGenerated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate the bracket.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <OrganizerSection title="Generate bracket" icon="layers" description={`${entrantCount} entrant${entrantCount === 1 ? '' : 's'} ready.`}>
      <div className="flex flex-col gap-3">
        <FormSelect label="Format" value={format} onChange={(e) => setFormat(e.target.value as BracketFormat)} options={FORMAT_OPTIONS} />
        <FormSelect label="Match length" value={matchFormat} onChange={(e) => setMatchFormat(e.target.value as MatchFormat)} options={MATCH_FORMAT_OPTIONS} />
        {format === 'pool_play' && (
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Pools" type="number" inputMode="numeric" value={poolCount} onChange={(e) => setPoolCount(e.target.value)} />
            <FormField label="Advance / pool" type="number" inputMode="numeric" value={advancers} onChange={(e) => setAdvancers(e.target.value)} />
          </div>
        )}
        {error && <div className="text-[13px] font-semibold text-[var(--coral)]">{error}</div>}
        <Button fullWidth onClick={generate} disabled={busy || entrantCount < 2}>{busy ? 'Generating…' : 'Generate bracket'}</Button>
      </div>
    </OrganizerSection>
  );
}
