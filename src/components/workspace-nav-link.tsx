import { Link } from '@tanstack/react-router'

export function WorkspaceNavLink({
  to,
  active,
  current = active,
  icon,
  children,
}: {
  to: '/' | '/admin'
  active: boolean
  current?: boolean
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      aria-current={current ? 'page' : undefined}
      className={`flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50 [&_svg]:size-4 ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'}`}
    >
      {icon}
      {children}
    </Link>
  )
}
