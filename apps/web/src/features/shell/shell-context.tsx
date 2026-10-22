import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface ShellState {
  sidebarOpen: boolean;
  isMobile: boolean;
  toggleSidebar: () => void;
  closeSidebarOnMobile: () => void;
}

const ShellContext = createContext<ShellState | null>(null);
const KEY = 'daiq-sidebar-collapsed';
const MOBILE_QUERY = '(max-width: 767px)';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function ShellProvider({ children }: { children: ReactNode }) {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setMobileOpen((open) => !open);
      return;
    }
    setCollapsed((value) => {
      try {
        localStorage.setItem(KEY, value ? '0' : '1');
      } catch {
        // Not persisting the preference is acceptable.
      }
      return !value;
    });
  }, [isMobile]);

  const closeSidebarOnMobile = useCallback(() => setMobileOpen(false), []);
  const sidebarOpen = isMobile ? mobileOpen : !collapsed;
  const value = useMemo(
    () => ({ sidebarOpen, isMobile, toggleSidebar, closeSidebarOnMobile }),
    [sidebarOpen, isMobile, toggleSidebar, closeSidebarOnMobile],
  );
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellState {
  const context = useContext(ShellContext);
  if (!context) throw new Error('useShell must be used inside <ShellProvider>');
  return context;
}
