import { ViewHeader } from '../features/shell/view-header';

export function NotFoundPanel({ title, message }: { title: string; message: string }) {
  return (
    <>
      <ViewHeader title={title} />
      <div className="flex flex-col items-start gap-2 px-6 py-16">
        <h2 className="text-lg font-semibold font-display">{title}</h2>
        <p className="text-fg-muted">{message}</p>
      </div>
    </>
  );
}
