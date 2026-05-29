import { type ReactNode } from 'react';
import { useDemoState } from '../../lib/demoState';

interface DemoBranchProps {
  loading?: ReactNode;
  error?: ReactNode;
  empty?: ReactNode;
  children: ReactNode;
}

export function DemoBranch({ loading, error, empty, children }: DemoBranchProps) {
  const { state } = useDemoState();
  if (state === 'loading' && loading !== undefined) return <>{loading}</>;
  if (state === 'error' && error !== undefined) return <>{error}</>;
  if (state === 'empty' && empty !== undefined) return <>{empty}</>;
  return <>{children}</>;
}
