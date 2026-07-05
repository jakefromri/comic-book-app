import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-bold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-accent-orange text-white shadow-md hover:bg-orange-600',
        gold: 'bg-accent-gold text-text-primary shadow-md hover:bg-yellow-400',
        outline: 'border-2 border-border bg-surface text-text-primary hover:bg-surface-raised',
        ghost: 'bg-transparent text-text-primary hover:bg-surface-raised',
        destructive: 'bg-accent-red text-white shadow-md hover:bg-red-600',
      },
      size: {
        default: 'h-12 px-5 text-base',
        sm: 'h-9 px-3 text-sm',
        lg: 'h-14 px-8 text-lg',
        xl: 'h-20 px-10 text-xl',
        icon: 'h-12 w-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
