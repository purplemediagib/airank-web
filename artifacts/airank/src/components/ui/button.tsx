import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * AI Rank / Button (Figma 15:769). Primary navy, hover ink, cyan 3px keyboard focus,
 * disabled = border fill with muted text. 40px desktop, 44px on touch layouts.
 */
const buttonVariants = cva(
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium leading-5 transition-[background-color,border-color,color,transform] duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan focus-visible:ring-offset-0 active:translate-y-px disabled:pointer-events-none aria-disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-navy text-white hover:bg-ink active:bg-ink disabled:bg-line disabled:text-muted-ink aria-disabled:bg-line aria-disabled:text-muted-ink aria-disabled:hover:bg-line',
        secondary:
          'border border-line bg-white text-ink hover:border-[#c9d2e0] hover:bg-canvas active:bg-[#eef2f7] disabled:bg-canvas disabled:text-muted-ink aria-disabled:text-muted-ink aria-disabled:hover:bg-white',
        outline:
          'border border-line bg-white text-ink hover:bg-canvas active:bg-[#eef2f7] disabled:text-muted-ink',
        ghost: 'text-muted-ink hover:bg-canvas hover:text-ink active:bg-[#eef2f7] disabled:text-muted-ink/60',
        destructive: 'bg-danger text-white hover:bg-[#9e3340] disabled:bg-line disabled:text-muted-ink',
        link: 'h-auto px-0 text-link underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-3 md:h-10',
        sm: 'h-9 px-3 text-[13px]',
        lg: 'h-11 px-5',
        icon: 'h-11 w-11 md:h-10 md:w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    if (asChild) {
      return (
        <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Comp>
      );
    }
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" aria-hidden />}
        {children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
