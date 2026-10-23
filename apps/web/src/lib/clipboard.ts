import { toast } from '@daiq/ui';
import { m } from '../i18n';

/** Copies text and confirms it with a toast (a new copy replaces the last toast). */
export function copyText(text: string, confirmation: string): void {
  void navigator.clipboard.writeText(text).then(
    () => toast(confirmation, { id: 'copy' }),
    () => toast.error(m.common.clipboardBlocked),
  );
}
