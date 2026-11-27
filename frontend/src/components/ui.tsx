import type { ReactNode } from 'react'

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`.trim()}>{children}</section>
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function StepLabel({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div className="step-label" aria-label={`Step ${step} of ${total}: ${label}`}>
      <span>STEP {step} OF {total}</span>
      <div className="step-track" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span key={index} className={index < step ? 'step-active' : ''} />
        ))}
      </div>
      <strong>{label}</strong>
    </div>
  )
}

export function EmptyState({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  )
}
