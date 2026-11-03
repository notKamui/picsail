import { cva } from 'class-variance-authority'

export const title = cva('scroll-m-20 font-semibold tracking-tight text-balance', {
  variants: {
    h: {
      1: 'text-4xl lg:text-5xl',
      2: 'text-3xl',
      3: 'text-2xl',
      4: 'text-xl',
    },
  },
})

export const eyebrow = cva('text-xs font-medium tracking-widest text-muted-foreground uppercase')

export const article =
  'prose prose-headings:font-semibold prose-headings:tracking-tight prose-a:font-medium prose-a:underline prose-a:decoration-border prose-a:underline-offset-4'

export const text = cva('', {
  variants: {
    variant: {
      DEFAULT: '',
      small: 'text-sm',
      muted: 'text-sm text-muted-foreground',
    },
    paragraphed: {
      true: 'space-y-6 leading-7',
      false: '',
    },
    color: {
      DEFAULT: '',
      primary: 'text-primary',
      secondary: 'text-secondary-foreground',
      error: 'text-destructive',
    },
  },
  defaultVariants: {
    variant: 'DEFAULT',
    paragraphed: false,
    color: 'DEFAULT',
  },
})

export const link = cva(
  'font-medium underline decoration-border underline-offset-4 hover:decoration-foreground',
  {
    variants: {
      color: {
        DEFAULT: 'text-foreground',
        primary: 'text-primary',
        secondary: 'text-secondary-foreground',
      },
    },
    defaultVariants: {
      color: 'DEFAULT',
    },
  },
)
