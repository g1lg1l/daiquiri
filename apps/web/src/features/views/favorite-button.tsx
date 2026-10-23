import { useFavorites, useToggleFavorite, type FavoriteKind } from '@daiq/data';
import { sortKeyBetween } from '@daiq/domain';
import { Button, Tooltip } from '@daiq/ui';
import { StarIcon } from 'lucide-react';
import { m } from '../../i18n';
import { useWorkspace } from '../workspace/workspace-context';

/** Star toggle that adds a project or saved view to the sidebar's Favorites. */
export function FavoriteButton({ kind, id }: { kind: FavoriteKind; id: string }) {
  const { workspace, userId } = useWorkspace();
  const favorites = useFavorites(workspace.id);
  const toggle = useToggleFavorite(workspace.id, userId);
  const current = favorites.data?.find((f) => f.entityKind === kind && f.entityId === id);
  const label = current ? m.shell.favorites.remove : m.shell.favorites.add;
  return (
    <Tooltip label={label}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        aria-pressed={Boolean(current)}
        onClick={() =>
          toggle.mutate({
            favorite: current ?? {
              entityKind: kind,
              entityId: id,
              sortKey: sortKeyBetween(favorites.data?.at(-1)?.sortKey ?? null, null),
            },
            active: Boolean(current),
          })
        }
      >
        <StarIcon className={current ? 'fill-brand-lime text-accent-text' : undefined} />
      </Button>
    </Tooltip>
  );
}
