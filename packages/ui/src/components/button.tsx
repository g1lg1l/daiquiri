import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';

export const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium whitespace-nowrap transition-[background-color,color,box-shadow,scale] duration-160 ease-out select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
    // Default icon size unless the icon sets its own size-* class.
    "[&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-accent-fg shadow-xs inset-shadow-[0_1px_0_oklch(1_0_0/18%)] hover:bg-accent/92 hover:shadow-glow',
        ink: 'bg-fg text-fg-inverted hover:bg-fg/85',
        secondary:
          'border border-border bg-surface text-fg shadow-xs hover:bg-surface-muted aria-expanded:bg-surface-muted',
        ghost: 'text-fg-muted hover:bg-surface-muted hover:text-fg aria-expanded:bg-surface-muted',
        danger: 'bg-danger text-white hover:bg-danger/85',
        link: 'h-auto px-0 text-accent-text underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-7 px-2.5',
        md: 'h-8 px-3',
        lg: 'h-10 px-4 text-sm',
        icon: 'size-8',
        'icon-sm': 'size-7',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <ButtonPrimitive className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
