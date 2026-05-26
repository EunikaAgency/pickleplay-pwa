import { createContext, useContext, useState, type ReactNode } from 'react';

export type DemoState = 'normal' | 'empty' | 'loading' | 'error' | 'offline';

interface DemoStateContextValue {
  state: DemoState;
  setState: (state: DemoState) => void;
  enabled: boolean;
}

const DemoStateContext = createContext<DemoStateContextValue>({
  state: 'normal',
  setState: () => {},
  enabled: false,
});

export function DemoStateProvider({ children }: { children: ReactNode }) {
  const [enabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('demo');
  });
  const [state, setState] = useState<DemoState>('normal');

  return (
    <DemoStateContext.Provider value={{ state, setState, enabled }}>
      {children}
    </DemoStateContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDemoState() {
  return useContext(DemoStateContext);
}
