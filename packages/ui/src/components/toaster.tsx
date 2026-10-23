import { lazy, Suspense } from 'react';
import { useTheme } from '../theme';

export interface ToastOptions {
  /** A later toast with the same id replaces this one. */
  id?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export type ToastKind = 'success' | 'info' | 'error';
export type ShowToast = (kind: ToastKind, message: string, options?: ToastOptions) => void;

let show: ShowToast | undefined;
const waiting: Parameters<ShowToast>[] = [];

function raise(...args: Parameters<ShowToast>) {
  if (show) show(...args);
  else waiting.push(args);
}

/** Toasts raised before the toaster has loaded wait for it. */
export const toast = Object.assign(
  (message: string, options?: ToastOptions) => raise('success', message, options),
  {
    info: (message: string, options?: ToastOptions) => raise('info', message, options),
    error: (message: string, options?: ToastOptions) => raise('error', message, options),
  },
);

/** Called by the toaster once it is mounted; returns the disconnect. */
export function connectToaster(next: ShowToast) {
  show = next;
  for (const args of waiting.splice(0)) next(...args);
  return () => {
    show = undefined;
  };
}

// Sileo and Motion load after first paint, in their own chunk.
const SileoToaster = lazy(() => import('./sileo-toaster'));

/** `labels` title toasts whose message is too long for the pill. */
export function Toaster({ labels }: { labels: Record<ToastKind, string> }) {
  const { resolved } = useTheme();
  return (
    <Suspense>
      <SileoToaster theme={resolved} labels={labels} />
    </Suspense>
  );
}
