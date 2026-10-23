import { useEffect } from 'react';
import { sileo, Toaster } from 'sileo';
import { connectToaster, type ToastKind } from './toaster';

/** Longer messages move into the toast's body under a short title. */
const PILL_LENGTH = 36;
const ACTION_DURATION = 8000;
/** Our ids ("copy", "undo") → Sileo's, so a repeated toast replaces the last one. */
const live = new Map<string, string>();

export default function SileoToaster({
  theme,
  labels,
}: {
  theme: 'light' | 'dark';
  labels: Record<ToastKind, string>;
}) {
  useEffect(
    () =>
      connectToaster((kind, message, options = {}) => {
        const previous = options.id && live.get(options.id);
        if (previous) sileo.dismiss(previous);
        const long = message.length > PILL_LENGTH;
        const button = options.action && {
          title: options.action.label,
          onClick: options.action.onClick,
        };
        const id = sileo[button ? 'action' : kind]({
          title: long ? labels[kind] : message,
          description: long ? message : options.description,
          button,
          // An action stays open (and reachable) for the toast's whole life.
          ...(button && {
            duration: ACTION_DURATION,
            autopilot: { expand: 0, collapse: ACTION_DURATION },
          }),
        });
        if (options.id) live.set(options.id, id);
      }),
    [labels],
  );
  return (
    <Toaster
      position="bottom-right"
      theme={theme}
      options={{
        // The pill is the inverse of the page, so the inverted ink keeps AA contrast.
        styles: {
          title: 'normal-case! text-fg-inverted!',
          description: 'text-fg-inverted/80! text-[13px]!',
          button: 'bg-fg-inverted! text-fg! hover:opacity-90',
        },
      }}
    />
  );
}
