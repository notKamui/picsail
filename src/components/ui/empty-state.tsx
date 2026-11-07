import { cn } from 'cn'

export function EmptyState({
  icon,
  title,
  description,
  className,
}: {
  icon: React.ReactNode
  title: string
  description: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-border bg-card/60 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-secondary text-muted-foreground [&_svg]:size-5">
        {icon}
      </span>
      <h3 className="mt-4 font-serif text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-pretty text-muted-foreground">{description}</p>
    </div>
  )
}
