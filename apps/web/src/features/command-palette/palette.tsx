import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useShortcuts } from '../shortcuts/use-shortcuts';

const PaletteDialog = lazy(() =>
  import('./palette-content').then((m) => ({ default: m.PaletteDialog })),
);

export interface PaletteAction {
  id: string;
  label: string;
  group: string;
  icon?: ReactNode;
  shortcut?: string;
  keywords?: string[];
  run: () => void;
}

interface PaletteContextValue {
  open: (query?: string) => void;
  register: (actions: PaletteAction[]) => () => void;
  showShortcuts: () => void;
}

const PaletteContext = createContext<PaletteContextValue | null>(null);

export function usePalette(): PaletteContextValue {
  const context = useContext(PaletteContext);
  if (!context) throw new Error('usePalette must be used inside <PaletteProvider>');
  return context;
}

/** Registers contextual actions (e.g. "Change status" on a task page) while mounted. */
export function usePaletteActions(actions: PaletteAction[]): void {
  const { register } = usePalette();
  useEffect(() => register(actions), [register, actions]);
}

export function PaletteProvider({
  children,
  onShowShortcuts,
}: {
  children: ReactNode;
  onShowShortcuts: () => void;
}) {
  const [state, setState] = useState<{ key: number; query: string } | null>(null);
  const [contextual, setContextual] = useState<PaletteAction[][]>([]);

  const open = useCallback(
    (query = '') => setState((s) => ({ key: (s?.key ?? 0) + 1, query })),
    [],
  );
  const register = useCallback((actions: PaletteAction[]) => {
    setContextual((current) => [...current, actions]);
    return () => setContextual((current) => current.filter((entry) => entry !== actions));
  }, []);
  const value = useMemo(
    () => ({ open, register, showShortcuts: onShowShortcuts }),
    [open, register, onShowShortcuts],
  );

  useShortcuts({ palette: () => open(), search: () => open() });

  return (
    <PaletteContext.Provider value={value}>
      {children}
      {state && (
        <Suspense fallback={null}>
          <PaletteDialog
            key={state.key}
            open
            onOpenChange={(next) => !next && setState(null)}
            initialQuery={state.query}
            contextual={contextual.flat()}
            onShowShortcuts={onShowShortcuts}
          />
        </Suspense>
      )}
    </PaletteContext.Provider>
  );
}
