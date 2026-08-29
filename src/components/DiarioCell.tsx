import { useState, useRef, useEffect } from 'react'
import { fmtBRL } from '../calculations'
import type { DiarioItem } from '../types'

interface Props {
  itens: DiarioItem[]
  total: number
  projected?: number  // valor projetado (fixo futuro) — mostrado em itálico quando não há itens
  onAdd: (item: { valor: number; nota: string }) => void
  onUpdate: (id: string, partial: { valor?: number; nota?: string }) => void
  onRemove: (id: string) => void
}

export default function DiarioCell({ itens, total, projected, onAdd, onUpdate, onRemove }: Props) {
  const [open, setOpen] = useState(false)
  const [newValor, setNewValor] = useState('')
  const [newNota, setNewNota] = useState('')
  const newValorRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) newValorRef.current?.focus()
  }, [open])

  function addItem() {
    const val = parseFloat(newValor.replace(',', '.'))
    if (isNaN(val) || val <= 0) return
    onAdd({ valor: val, nota: newNota.trim() })
    setNewValor('')
    setNewNota('')
    newValorRef.current?.focus()
  }

  if (!open) {
    const hasItens = itens.length > 0
    // Valor projetado (sem itens manuais): mostra em itálico
    if (!hasItens && projected !== undefined && projected > 0) {
      return (
        <button type="button" className="cell-display projected" onClick={() => setOpen(true)} title="Valor projetado — clique para registrar">
          <em>{fmtBRL(projected)}</em>
        </button>
      )
    }
    return (
      <button
        type="button"
        className={`cell-display${!total ? ' empty' : ''}`}
        onClick={() => setOpen(true)}
        title={hasItens ? `${itens.length} item${itens.length > 1 ? 's' : ''}` : undefined}
      >
        {total ? fmtBRL(total) : '—'}
        {hasItens && (
          <span className="diario-badge">{itens.length}</span>
        )}
      </button>
    )
  }

  return (
    <>
      {/* Overlay para fechar ao tocar fora (mobile) */}
      <div
        className="diario-overlay"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div className="diario-expand">
      {itens.length > 0 && (
        <ul className="diario-list">
          {itens.map((item) => (
            <li key={item.id} className="diario-item">
              <ItemRow item={item} onUpdate={onUpdate} onRemove={onRemove} />
            </li>
          ))}
        </ul>
      )}

      <div className="diario-add-row">
        <input
          ref={newValorRef}
          type="number"
          min="0"
          step="0.01"
          placeholder="Valor"
          value={newValor}
          className="diario-valor-input"
          onChange={(e) => setNewValor(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addItem() }}
        />
        <input
          type="text"
          placeholder="Descrição"
          value={newNota}
          className="diario-nota-input"
          onChange={(e) => setNewNota(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addItem() }}
          maxLength={80}
        />
        <button type="button" className="diario-add-btn" onClick={addItem} title="Adicionar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="diario-footer">
        {itens.length > 0 && <span className="diario-total">Total: {fmtBRL(total)}</span>}
        <button type="button" className="diario-close" onClick={() => setOpen(false)}>
          Fechar
        </button>
      </div>
    </div>
    </>
  )
}

function ItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: DiarioItem
  onUpdate: (id: string, partial: { valor?: number; nota?: string }) => void
  onRemove: (id: string) => void
}) {
  const [editingVal, setEditingVal] = useState(false)
  const [rawVal, setRawVal] = useState(String(item.valor))
  const [editingNota, setEditingNota] = useState(false)
  const [rawNota, setRawNota] = useState(item.nota)

  function commitVal() {
    const val = parseFloat(rawVal.replace(',', '.'))
    if (!isNaN(val) && val > 0) onUpdate(item.id, { valor: val })
    setEditingVal(false)
  }

  function commitNota() {
    onUpdate(item.id, { nota: rawNota.trim() })
    setEditingNota(false)
  }

  return (
    <div className="diario-item-row">
      {editingVal ? (
        <input
          autoFocus
          type="number"
          min="0"
          step="0.01"
          value={rawVal}
          className="diario-valor-input"
          onChange={(e) => setRawVal(e.target.value)}
          onBlur={commitVal}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') commitVal() }}
        />
      ) : (
        <button className="diario-item-val" onClick={() => { setRawVal(String(item.valor)); setEditingVal(true) }}>
          {fmtBRL(item.valor)}
        </button>
      )}

      {editingNota ? (
        <input
          autoFocus
          type="text"
          value={rawNota}
          className="diario-nota-input"
          onChange={(e) => setRawNota(e.target.value)}
          onBlur={commitNota}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') commitNota() }}
          maxLength={80}
        />
      ) : (
        <button
          className={`diario-item-nota ${!item.nota ? 'empty' : ''}`}
          onClick={() => { setRawNota(item.nota); setEditingNota(true) }}
        >
          {item.nota || 'Descrição'}
        </button>
      )}

      <button
        type="button"
        className="diario-remove"
        onClick={() => onRemove(item.id)}
        title="Remover"
        aria-label="Remover item"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}
