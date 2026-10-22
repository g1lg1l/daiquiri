import { Input as InputPrimitive } from '@base-ui/react/input';
import type { ComponentProps } from 'react';
import { cn } from '../cn';

const fieldClass =
  'w-full rounded-md border border-border bg-surface px-2.5 text-[13px] text-fg shadow-xs transition-colors outline-none placeholder:text-fg-subtle focus-visible:border-focus focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus/25 disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-danger/20';

export function Input({ className, ...props }: InputPrimitive.Props) {
  return <InputPrimitive className={cn(fieldClass, 'h-8', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(fieldClass, 'min-h-20 py-2', className)} {...props} />;
}

export function Label({
  className,
  htmlFor,
  ...props
}: ComponentProps<'label'> & { htmlFor: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('text-[13px] font-medium text-fg', className)}
      {...props}
    />
  );
}

export function FieldError({ className, ...props }: ComponentProps<'p'>) {
  return <p role="alert" className={cn('text-xs text-danger', className)} {...props} />;
}
