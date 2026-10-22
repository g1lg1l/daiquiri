import { Wordmark } from './wordmark';

export function Splash() {
  return (
    <div className="grid h-dvh place-items-center" aria-busy="true" aria-live="polite">
      <Wordmark className="animate-pulse text-2xl opacity-80" />
      <span className="sr-only">Loading Daiq</span>
    </div>
  );
}
