import {
  useFavorites,
  useSavedViewActions,
  useSavedViews,
  useToggleFavorite,
  type SavedView,
} from '@daiq/data';
import { can, sameViewConfig, toViewConfig, type Team, type ViewSearch } from '@daiq/domain';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  FieldError,
  Input,
  Label,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Tooltip,
} from '@daiq/ui';
import {
  BookmarkPlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
  UsersIcon,
} from 'lucide-react';
import { useState } from 'react';
import { formString } from '../../lib/forms';
import { newId } from '../../lib/ids';
import { pushUndo } from '../undo/undo';
import { useWorkspace } from '../workspace/workspace-context';
import { FavoriteButton } from './favorite-button';
import type { SetSearch } from './view-controls';

/** The saved view a team task list was opened from, if it still exists. */
export function useActiveSavedView(viewId: string | undefined): SavedView | undefined {
  const { workspace } = useWorkspace();
  const views = useSavedViews(workspace.id);
  return viewId ? views.data?.find((view) => view.id === viewId) : undefined;
}

function ViewDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  initial: { name: string; isShared: boolean };
  onSubmit: (values: { name: string; isShared: boolean }) => void;
}) {
  const { workspace } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const name = formString(form, 'name').trim();
            if (!name) return setError('Give the view a name.');
            onSubmit({ name, isShared: form.get('shared') === 'on' });
            onOpenChange(false);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="view-name">Name</Label>
            <Input
              id="view-name"
              name="name"
              required
              maxLength={80}
              autoFocus
              defaultValue={initial.name}
              placeholder="Open bugs"
            />
          </div>
          {/* Guests can only keep private views (enforced by RLS too). */}
          {workspace.role !== 'guest' && (
            <label className="flex items-center gap-2 text-[13px] text-fg-muted">
              <input
                type="checkbox"
                name="shared"
                defaultChecked={initial.isShared}
                className="accent-(--accent)"
              />
              Share with everyone in the workspace
            </label>
          )}
          {error && <FieldError>{error}</FieldError>}
          <DialogFooter>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Header controls of a team task list: "Save view" for an ad-hoc view, or, for a
 * saved one, a Modified chip with Save/Reset, the favorite star and a menu.
 */
export function SavedViewControls({
  team,
  search,
  setSearch,
  view,
}: {
  team: Team;
  search: ViewSearch;
  setSearch: SetSearch;
  view: SavedView | undefined;
}) {
  const { workspace, userId } = useWorkspace();
  const actions = useSavedViewActions(workspace.id, userId);
  const favorites = useFavorites(workspace.id);
  const toggleFavorite = useToggleFavorite(workspace.id, userId);
  const [dialog, setDialog] = useState<'create' | 'rename' | null>(null);

  if (!view) {
    if (sameViewConfig(search, {})) return null;
    return (
      <>
        <Button variant="ghost" size="sm" onClick={() => setDialog('create')}>
          <BookmarkPlusIcon /> <span className="max-md:sr-only">Save view</span>
        </Button>
        <ViewDialog
          open={dialog === 'create'}
          onOpenChange={(open) => setDialog(open ? 'create' : null)}
          title="Save view"
          submitLabel="Save view"
          initial={{ name: '', isShared: false }}
          onSubmit={({ name, isShared }) => {
            const id = newId();
            actions.create.mutate({
              id,
              teamId: team.id,
              name,
              isShared,
              config: toViewConfig(search),
            });
            setSearch({ view: id });
          }}
        />
      </>
    );
  }

  const canEdit =
    view.ownerId === userId || (view.isShared && can(workspace.role, 'workspace.update'));
  const modified = !sameViewConfig(search, view.config);
  const reset = () => setSearch({ ...emptyConfig(search), ...view.config, view: view.id });

  return (
    <>
      {modified && (
        <span className="mr-1 flex items-center gap-1 rounded-md bg-surface-muted py-0.5 pr-0.5 pl-2 text-xs text-fg-muted">
          Modified
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={reset}>
            <RotateCcwIcon /> Reset
          </Button>
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs"
              onClick={() =>
                actions.update.mutate({ id: view.id, patch: { config: toViewConfig(search) } })
              }
            >
              Save
            </Button>
          )}
        </span>
      )}
      {view.isShared && (
        <Tooltip label="Shared with the workspace">
          <span className="flex size-7 items-center justify-center text-fg-subtle">
            <UsersIcon className="size-4" aria-label="Shared with the workspace" />
          </span>
        </Tooltip>
      )}
      <FavoriteButton kind="view" id={view.id} />
      {canEdit && (
        <>
          <Menu>
            <MenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label="View actions" />}
            >
              <MoreHorizontalIcon />
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem onClick={() => setDialog('rename')}>
                <PencilIcon /> Rename or share
              </MenuItem>
              <MenuItem
                destructive
                onClick={() => {
                  // The database drops the view's favorites with it; undo puts both back.
                  const favorite = favorites.data?.find(
                    (f) => f.entityKind === 'view' && f.entityId === view.id,
                  );
                  actions.remove.mutate(view.id);
                  setSearch({ view: undefined });
                  pushUndo(
                    {
                      label: `Delete view ${view.name}`,
                      undo: async () => {
                        await actions.create.mutateAsync(view);
                        if (favorite) await toggleFavorite.mutateAsync({ favorite, active: false });
                      },
                    },
                    { toast: `Deleted view ${view.name}` },
                  );
                }}
              >
                <Trash2Icon /> Delete view
              </MenuItem>
            </MenuContent>
          </Menu>
          <ViewDialog
            open={dialog === 'rename'}
            onOpenChange={(open) => setDialog(open ? 'rename' : null)}
            title="Rename view"
            submitLabel="Save"
            initial={{ name: view.name, isShared: view.isShared }}
            onSubmit={(patch) => actions.update.mutate({ id: view.id, patch })}
          />
        </>
      )}
    </>
  );
}

/** Clears every view param so a reset does not keep filters the saved view lacks. */
function emptyConfig(search: ViewSearch): Partial<ViewSearch> {
  return Object.fromEntries(Object.keys(toViewConfig(search)).map((key) => [key, undefined]));
}
