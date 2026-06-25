import { useRef, useEffect, useState } from 'react'
import { fmtBRL } from '../calculations'

interface Props {
  value: number
  isProjected?: boolean
  onChange: (v: number) => void
  onMoveNext?: () => void
  onMovePrev?: () => void
}

export default function CellInput({ value, isProjected, onChange, onMoveNext, onMovePrev }: Props) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const startEdit = () => {
    setRaw(value ? String(value) : '')
    setEditing(true)
  }

  const commit = () => {
    const parsed = parseFloat(raw.replace(',', '.'))
    onChange(isNaN(parsed) ? 0 : Math.max(0, parsed))
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min="0"
        step="0.01"
        value={raw}
        className="cell-input"
        onChange={(e) => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); onMoveNext?.() }
          if (e.key === 'Escape') { setEditing(false) }
          if (e.key === 'Tab') commit()
          if (e.key === 'ArrowDown') { e.preventDefault(); commit(); onMoveNext?.() }
          if (e.key === 'ArrowUp') { e.preventDefault(); commit(); onMovePrev?.() }
        }}
      />
    )
  }

  const display = value ? fmtBRL(value) : ''
  const isEmpty = !value

  return (
    <button
      type="button"
      className={`cell-display${isProjected ? ' projected' : ''}${isEmpty ? ' empty' : ''}`}
      onClick={startEdit}
      onFocus={startEdit}
      tabIndex={0}
      aria-label={isProjected ? `${display} (projetado)` : display || '—'}
    >
      {display || '—'}
    </button>
  )
}
