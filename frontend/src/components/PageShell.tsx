import type { PropsWithChildren, ReactNode } from 'react'

interface PageShellProps extends PropsWithChildren {
  eyebrow: string
  title: string
  subtitle: string
  aside?: ReactNode
}

export function PageShell({ eyebrow, title, subtitle, aside, children }: PageShellProps) {
  return (
    <div className="app-shell">
      <div className="app-shell__inner">
        <header className="app-header">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h1 className="page-title">{title}</h1>
            <p className="page-subtitle">{subtitle}</p>
          </div>
          {aside}
        </header>
        {children}
      </div>
    </div>
  )
}
