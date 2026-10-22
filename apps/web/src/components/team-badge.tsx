export function TeamBadge({ teamKey }: { teamKey: string }) {
  return (
    <span
      aria-hidden
      className="flex size-5 items-center justify-center rounded-[5px] bg-surface-emphasis text-[10px] font-semibold text-fg-muted"
    >
      {teamKey.slice(0, 2)}
    </span>
  );
}
