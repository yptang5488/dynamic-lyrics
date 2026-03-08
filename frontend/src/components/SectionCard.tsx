import type { PropsWithChildren } from 'react'

interface SectionCardProps extends PropsWithChildren {
  title: string
  subtitle?: string
}

export function SectionCard({ title, subtitle, children }: SectionCardProps) {
  return (
    <section className="section-card">
      <h2>{title}</h2>
      {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
      {children}
    </section>
  )
}
