import { useState, useRef, useEffect } from 'react'

interface Props {
  nota: string | undefined
  onChange: (nota: string) => void
}

export default function NoteField({ nota, onChange }: Props) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState(nota ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setRaw(nota ?? '')
      inputRef.current?.focus()
    }
  }, [editing])

  function commit() {
    onChange(raw.trim())
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={raw}
        className="note-input"
        placeholder="Descrição…"
        onChange={(e) => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); commit() }
        }}
        maxLength={120}
      />
    )
  }

  if (nota) {
    return (
      <button type="button" className="note-text" onClick={() => setEditing(true)} title="Editar nota">
        {nota}
      </button>
    )
  }

  return (
    <button type="button" className="note-add" onClick={() => setEditing(true)} title="Adicionar nota">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    </button>
  )
}
