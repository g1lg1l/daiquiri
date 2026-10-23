import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  attachmentPath,
  DaiqError,
  formatBytes,
  MAX_ATTACHMENT_BYTES,
  safeFileName,
  type Attachment,
  type Task,
} from '@daiq/domain';
import { patchTask } from './cache';
import { useDaiqClient } from './context';
import { ensureOk, errorTexts, toDaiqError, unwrap } from './errors';
import { keys } from './keys';

const BUCKET = 'attachments';
const URL_SECONDS = 60 * 60;

/** An attachment as listed in the app; `uploading` while its file is on its way. */
export type ListedAttachment = Attachment & { uploading?: boolean };

export function useAttachments(taskId: string) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.attachments(taskId),
    queryFn: async (): Promise<ListedAttachment[]> =>
      unwrap(
        await client
          .from('attachments')
          .select(
            'id, workspace_id, task_id, storage_path, file_name, mime_type, size_bytes, uploaded_by, created_at',
          )
          .eq('task_id', taskId)
          .order('created_at'),
      ).map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id,
        taskId: row.task_id,
        storagePath: row.storage_path,
        fileName: row.file_name,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        uploadedBy: row.uploaded_by,
        createdAt: row.created_at,
      })),
  });
}

/**
 * A short-lived signed URL for a private file. With `download`, the browser
 * saves the file under its name instead of opening it.
 */
export function useAttachmentUrl(attachment: Attachment | undefined, download = false) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: [
      ...keys.attachments(attachment?.taskId ?? ''),
      'url',
      attachment?.id ?? '',
      download,
    ],
    enabled: Boolean(attachment) && !('uploading' in (attachment ?? {})),
    staleTime: (URL_SECONDS - 300) * 1000,
    gcTime: (URL_SECONDS - 300) * 1000,
    queryFn: async (): Promise<string> => {
      const { data, error } = await client.storage
        .from(BUCKET)
        .createSignedUrl(
          attachment?.storagePath ?? '',
          URL_SECONDS,
          download ? { download: attachment?.fileName ?? true } : undefined,
        );
      if (error) throw toDaiqError(error);
      return data.signedUrl;
    },
  });
}

/** Upload files to a task and delete them. The file goes up first, then its row. */
export function useAttachmentActions(task: Pick<Task, 'id' | 'workspaceId'>, userId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const key = keys.attachments(task.id);
  const setCount = (delta: number) => {
    const list = queryClient.getQueryData<ListedAttachment[]>(key) ?? [];
    patchTask(queryClient, task.id, {
      attachmentCount: Math.max(0, list.filter((a) => !a.uploading).length + delta),
    });
  };

  const upload = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        throw new DaiqError(
          'validation',
          errorTexts.fileTooLarge(
            file.name,
            formatBytes(file.size),
            formatBytes(MAX_ATTACHMENT_BYTES),
          ),
        );
      }
      const path = attachmentPath(task.workspaceId, task.id, id, file.name);
      const mimeType = file.type || 'application/octet-stream';
      const stored = await client.storage
        .from(BUCKET)
        .upload(path, file, { contentType: mimeType, upsert: false });
      if (stored.error) throw toDaiqError(stored.error);
      const inserted = await client.from('attachments').insert({
        id,
        workspace_id: task.workspaceId,
        task_id: task.id,
        storage_path: path,
        file_name: safeFileName(file.name),
        mime_type: mimeType,
        size_bytes: file.size,
      });
      if (inserted.error) {
        // No orphan files: take the upload back if the row could not be written.
        await client.storage.from(BUCKET).remove([path]);
        ensureOk(inserted);
      }
    },
    onMutate: ({ id, file }) => {
      void queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<ListedAttachment[]>(key, (list = []) => [
        ...list,
        {
          id,
          workspaceId: task.workspaceId,
          taskId: task.id,
          storagePath: '',
          fileName: safeFileName(file.name),
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          uploadedBy: userId,
          createdAt: new Date().toISOString(),
          uploading: true,
        },
      ]);
    },
    onError: (_error, { id }) =>
      queryClient.setQueryData<ListedAttachment[]>(key, (list = []) =>
        list.filter((a) => a.id !== id),
      ),
    onSuccess: () => setCount(1),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: async (attachment: Attachment) => {
      const removed = await client.storage.from(BUCKET).remove([attachment.storagePath]);
      if (removed.error) throw toDaiqError(removed.error);
      ensureOk(await client.from('attachments').delete().eq('id', attachment.id));
    },
    onMutate: (attachment) => {
      // An in-flight refresh must not bring the file back, nor re-sign its URL.
      void queryClient.cancelQueries({ queryKey: key, exact: true });
      queryClient.removeQueries({ queryKey: [...key, 'url', attachment.id] });
      const previous = queryClient.getQueryData<ListedAttachment[]>(key);
      queryClient.setQueryData<ListedAttachment[]>(key, (list = []) =>
        list.filter((a) => a.id !== attachment.id),
      );
      setCount(0);
      return { previous };
    },
    onError: (_error, _attachment, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return { upload, remove };
}
