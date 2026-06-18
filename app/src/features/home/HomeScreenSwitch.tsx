import { HomeScreen } from './HomeScreen';
import { HomeScreenRefined } from './HomeScreenRefined';
import { usePlayerDesign } from '../../shared/lib/playerDesign';
import type { Navigate } from '../../shared/lib/navigation';

interface HomeScreenSwitchProps {
  onNavigate: Navigate;
}

/**
 * Picks the Home layout for the v1 player UI: the new ("refined") layout vs the
 * original ("classic") one, driven by the app-wide design selector
 * (`usePlayerDesign`). The floating control that flips this lives in
 * `DesignSwitch` (mounted from App.tsx); the v2.1 design is handled upstream in
 * App.tsx, so this component only ever sees 'new' or 'classic'.
 */
export function HomeScreenSwitch({ onNavigate }: HomeScreenSwitchProps) {
  const design = usePlayerDesign((s) => s.design);
  return design === 'classic'
    ? <HomeScreen onNavigate={onNavigate} />
    : <HomeScreenRefined onNavigate={onNavigate} />;
}
