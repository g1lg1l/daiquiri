import { Toaster as Sonner } from 'sonner';
import { useTheme } from '../theme';

export { toast } from 'sonner';

export function Toaster() {
  const { resolved } = useTheme();
  return (
    <Sonner
      theme={resolved}
      position="bottom-right"
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            '!rounded-lg !border !border-border !bg-overlay !text-fg !shadow-popover !text-[13px] !font-sans',
          description: '!text-fg-muted',
          actionButton: '!bg-fg !text-fg-inverted',
        },
      }}
    />
  );
}
