import type { SaldoStatus } from '../types'

const labels: Record<SaldoStatus, string> = {
  green: 'Ok',
  yellow: 'Atenção',
  red: 'Negativo',
}

const icons: Record<SaldoStatus, string> = {
  green: '✓',
  yellow: '!',
  red: '✕',
}

interface Props {
  status: SaldoStatus
  className?: string
}

export default function StatusBadge({ status, className = '' }: Props) {
  return (
    <span className={`status-badge ${status} ${className}`} aria-label={labels[status]}>
      <span aria-hidden="true">{icons[status]}</span>
      {labels[status]}
    </span>
  )
}
