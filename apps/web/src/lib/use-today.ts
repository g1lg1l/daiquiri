import { toIsoDate } from '@daiq/domain';
import { useEffect, useState } from 'react';

/** Today's ISO date, re-rendered when the day changes (keeps render pure). */
export function useToday(): string {
  const [today, setToday] = useState(() => toIsoDate(new Date()));
  useEffect(() => {
    const timer = setInterval(() => {
      const next = toIsoDate(new Date());
      setToday((current) => (current === next ? current : next));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);
  return today;
}

/** Current instant as ISO string, for event handlers (not render). */
export function nowIso(): string {
  return new Date().toISOString();
}
