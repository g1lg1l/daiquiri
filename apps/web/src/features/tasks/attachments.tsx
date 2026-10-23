import {
  useAuth,
  useAttachmentActions,
  useAttachments,
  useAttachmentUrl,
  type ListedAttachment,
} from '@daiq/data';
import { formatBytes, isPreviewableImage, type Task } from '@daiq/domain';
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Spinner,
  toast,
  Tooltip,
} from '@daiq/ui';
import { dropTargetForExternal } from '@atlaskit/pragmatic-drag-and-drop/external/adapter';
import { containsFiles, getFiles } from '@atlaskit/pragmatic-drag-and-drop/external/file';
import { DownloadIcon, FileIcon, PaperclipIcon, Trash2Icon } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { m } from '../../i18n';
import { newId } from '../../lib/ids';
import { timeAgo } from '../../lib/time';
import { useWorkspace, useWorkspaceData } from '../workspace/workspace-context';

/** Files attached to a task: drop or pick files to upload, raster images preview inline. */
export function Attachments({ task }: { task: Task }) {
  const { workspace, userId } = useWorkspace();
  const auth = useAuth();
  // The public demo does not host files (enforced by storage and table policies).
  const anonymous = auth.status === 'signed-in' && auth.isAnonymous;
  const attachments = useAttachments(task.id);
  const actions = useAttachmentActions(task, userId);
  const input = useRef<HTMLInputElement>(null);
  const zone = useRef<HTMLElement>(null);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState<ListedAttachment | null>(null);
  const list = attachments.data ?? [];
  const canDelete = (a: ListedAttachment) =>
    a.uploadedBy === userId || workspace.role === 'owner' || workspace.role === 'admin';

  const uploadAll = (files: Iterable<File>) => {
    for (const file of files) {
      // Failures (too large, rejected) are reported by the global mutation handler.
      actions.upload.mutate({ id: newId(), file });
    }
  };
  const onDropFiles = useEffectEvent((files: File[]) => uploadAll(files));

  // Dropping files from the desktop is a pointer shortcut; "Attach files" does the same.
  useEffect(() => {
    const element = zone.current;
    if (!element) return;
    return dropTargetForExternal({
      element,
      canDrop: (args) => !anonymous && containsFiles(args),
      onDragEnter: () => setDragging(true),
      onDragLeave: () => setDragging(false),
      onDrop: ({ source }) => {
        setDragging(false);
        onDropFiles(getFiles({ source }));
      },
    });
  }, [anonymous]);

  const images = list.filter((a) => isPreviewableImage(a.mimeType));
  const files = list.filter((a) => !isPreviewableImage(a.mimeType));

  return (
    <section
      ref={zone}
      aria-labelledby={`attachments-${task.id}`}
      className={cn(
        'flex flex-col gap-2 rounded-lg transition-colors',
        dragging && 'bg-accent-subtle/40 outline-2 outline-accent outline-dashed',
      )}
    >
      <div className="flex items-center gap-2">
        <h2 id={`attachments-${task.id}`} className="text-[13px] font-semibold">
          {m.task.attachments.heading}
        </h2>
        {list.length > 0 && <span className="text-xs text-fg-subtle tabular">{list.length}</span>}
        {anonymous ? (
          <Link to="/signup" className="ml-auto text-xs text-accent-text hover:underline">
            {m.task.attachments.signUp}
          </Link>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-fg-muted"
            onClick={() => input.current?.click()}
          >
            <PaperclipIcon /> {m.task.attachments.attach}
          </Button>
        )}
        <input
          ref={input}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-label={m.task.attachments.attach}
          onChange={(event) => {
            uploadAll(event.target.files ?? []);
            event.target.value = '';
          }}
        />
      </div>
      {list.length === 0 && !anonymous && (
        <p className="text-xs text-fg-subtle">{m.task.attachments.dropHint}</p>
      )}
      {images.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
          {images.map((attachment) => (
            <li key={attachment.id}>
              <ImageTile
                attachment={attachment}
                onDelete={canDelete(attachment) ? () => setDeleting(attachment) : undefined}
              />
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {files.map((attachment) => (
            <li key={attachment.id}>
              <FileRow
                attachment={attachment}
                onDelete={canDelete(attachment) ? () => setDeleting(attachment) : undefined}
              />
            </li>
          ))}
        </ul>
      )}
      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogTitle>{m.task.attachments.confirmTitle(deleting?.fileName ?? '')}</DialogTitle>
          <DialogDescription>{m.task.attachments.confirmBody}</DialogDescription>
          <DialogFooter>
            <Button onClick={() => setDeleting(null)}>{m.common.cancel}</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleting)
                  actions.remove.mutate(deleting, {
                    onSuccess: () => toast(m.task.attachments.deleted(deleting.fileName)),
                  });
                setDeleting(null);
              }}
            >
              {m.task.attachments.deleteFile}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function DownloadButton({ attachment }: { attachment: ListedAttachment }) {
  const url = useAttachmentUrl(attachment.uploading ? undefined : attachment, true);
  return (
    <Tooltip label={m.task.attachments.download(attachment.fileName)}>
      <a
        href={url.data}
        aria-label={m.task.attachments.download(attachment.fileName)}
        aria-disabled={!url.data}
        className="flex size-7 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg aria-disabled:pointer-events-none aria-disabled:opacity-50"
      >
        <DownloadIcon className="size-4" />
      </a>
    </Tooltip>
  );
}

function DeleteButton({ name, onDelete }: { name: string; onDelete: () => void }) {
  return (
    <Tooltip label={m.common.delete}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={m.task.attachments.delete(name)}
        onClick={onDelete}
      >
        <Trash2Icon />
      </Button>
    </Tooltip>
  );
}

function FileRow({
  attachment,
  onDelete,
}: {
  attachment: ListedAttachment;
  onDelete: (() => void) | undefined;
}) {
  const data = useWorkspaceData();
  const uploader = attachment.uploadedBy ? data.membersById.get(attachment.uploadedBy) : undefined;
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-[13px]">
      {attachment.uploading ? (
        <Spinner className="size-4" />
      ) : (
        <FileIcon aria-hidden className="size-4 shrink-0 text-fg-subtle" />
      )}
      <span className="min-w-0 flex-1 truncate">{attachment.fileName}</span>
      <span className="hidden shrink-0 text-xs text-fg-subtle sm:inline">
        {formatBytes(attachment.sizeBytes)}
        {uploader && ` · ${uploader.displayName}`} · {timeAgo(attachment.createdAt)}
      </span>
      {!attachment.uploading && <DownloadButton attachment={attachment} />}
      {onDelete && !attachment.uploading && (
        <DeleteButton name={attachment.fileName} onDelete={onDelete} />
      )}
    </div>
  );
}

function ImageTile({
  attachment,
  onDelete,
}: {
  attachment: ListedAttachment;
  onDelete: (() => void) | undefined;
}) {
  const preview = useAttachmentUrl(attachment.uploading ? undefined : attachment);
  return (
    <figure className="group/tile relative overflow-hidden rounded-lg border border-border bg-surface-subtle">
      <div className="flex aspect-[4/3] items-center justify-center">
        {preview.data ? (
          <img
            src={preview.data}
            alt={attachment.fileName}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <Spinner className="size-4" />
        )}
      </div>
      <figcaption className="truncate px-2 py-1 text-[11px] text-fg-muted">
        {attachment.fileName}
      </figcaption>
      {!attachment.uploading && (
        <div className="absolute top-1 right-1 flex gap-0.5 rounded-md bg-surface/90 opacity-0 shadow-xs group-focus-within/tile:opacity-100 group-hover/tile:opacity-100">
          <DownloadButton attachment={attachment} />
          {onDelete && <DeleteButton name={attachment.fileName} onDelete={onDelete} />}
        </div>
      )}
    </figure>
  );
}
