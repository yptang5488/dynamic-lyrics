import type { PropsWithChildren, ReactNode } from 'react'

interface PageShellProps extends PropsWithChildren {
  eyebrow?: string
  title: string
  subtitle: string
  aside?: ReactNode
  hideHeader?: boolean
}

export function PageShell({ eyebrow, title, subtitle, aside, hideHeader = false, children }: PageShellProps) {
  return (
    <div className="app-shell">
      <div className="app-shell__inner">
        {hideHeader ? null : (
          <header className="app-header">
            <div>
              {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
              <h1 className="page-title">{title}</h1>
              <p className="page-subtitle">{subtitle}</p>
            </div>
            {aside}
          </header>
        )}
        {children}
      </div>
    </div>
  )
}
