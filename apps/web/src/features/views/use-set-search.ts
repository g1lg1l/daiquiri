import type { ViewSearch } from '@daiq/domain';
import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

/**
 * Merges a patch into the current view search params. Display/filter changes
 * replace the history entry; opening or closing the peek pushes one so Back
 * closes the preview.
 */
export function useSetSearch() {
  const navigate = useNavigate();
  return useCallback(
    (patch: Partial<ViewSearch>) =>
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => ({ ...previous, ...patch }),
        replace: !('peek' in patch),
      }),
    [navigate],
  );
}
