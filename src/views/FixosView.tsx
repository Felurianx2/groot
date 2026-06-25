import { useState } from 'react'
import { useStore } from '../store'
import type { Fixo } from '../types'
import { fmtBRL, MONTH_NAMES } from '../calculations'

const TODAY_YYYYMM = new Date().toISOString().slice(0, 7)

const emptyForm = {
  tipo: 'saida' as 'entrada' | 'saida',
  dia: 1,
  valor: '',
  descricao: '',
  inicio: TODAY_YYYYMM,
  fim: '',
}

function FixoMeta(f: Fixo) {
  const start = f.inicio ? `${MONTH_NAMES[parseInt(f.inicio.slice(5)) - 1]}/${f.inicio.slice(0, 4)}` : ''
  const end = f.fim ? `${MONTH_NAMES[parseInt(f.fim.slice(5)) - 1]}/${f.fim.slice(0, 4)}` : 'sem fim'
  return `Dia ${f.dia} · ${start} → ${end}`
}

export default function FixosView() {
  const { fixos, addFixo, removeFixo } = useStore()
  const [form, setForm] = useState(emptyForm)
  const [adding, setAdding] = useState(false)

  const entradas = fixos.filter((f) => f.tipo === 'entrada')
  const saidas = fixos.filter((f) => f.tipo === 'saida')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const valor = parseFloat(String(form.valor).replace(',', '.'))
    if (!valor || valor <= 0 || !form.descricao.trim()) return
    addFixo({
      tipo: form.tipo,
      dia: Number(form.dia),
      valor,
      descricao: form.descricao.trim(),
      inicio: form.inicio,
      fim: form.fim || null,
    })
    setForm(emptyForm)
    setAdding(false)
  }

  return (
    <div>
      <div className="view-header" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.03em' }}>Lançamentos Fixos</h1>
        {!adding && (
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Novo fixo
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <form className="form-card" onSubmit={handleSubmit}>
          <div className="form-title">Novo lançamento fixo</div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="tipo">Tipo</label>
              <select
                id="tipo"
                className="input input-select"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as 'entrada' | 'saida' })}
              >
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="dia">Dia do mês</label>
              <input
                id="dia"
                type="number"
                min="1"
                max="31"
                className="input"
                value={form.dia}
                onChange={(e) => setForm({ ...form, dia: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="field">
              <label htmlFor="valor">Valor (R$)</label>
              <input
                id="valor"
                type="number"
                min="0.01"
                step="0.01"
                className="input"
                placeholder="0,00"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                required
              />
            </div>
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label htmlFor="descricao">Descrição</label>
              <input
                id="descricao"
                type="text"
                className="input"
                placeholder="Ex.: Aluguel, Salário..."
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                required
                maxLength={60}
              />
            </div>
            <div className="field">
              <label htmlFor="inicio">Início</label>
              <input
                id="inicio"
                type="month"
                className="input"
                value={form.inicio}
                onChange={(e) => setForm({ ...form, inicio: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="fim">Fim (opcional)</label>
              <input
                id="fim"
                type="month"
                className="input"
                value={form.fim}
                onChange={(e) => setForm({ ...form, fim: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="submit" className="btn btn-primary">Salvar</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setAdding(false); setForm(emptyForm) }}>Cancelar</button>
          </div>
        </form>
      )}

      {/* Entradas */}
      <div className="section-title">Entradas recorrentes</div>
      {entradas.length === 0 ? (
        <p style={{ color: 'var(--ink-faint)', fontSize: 13, marginBottom: 24 }}>Nenhuma entrada fixa cadastrada.</p>
      ) : (
        <div className="fixos-list">
          {entradas.map((f) => (
            <div key={f.id} className="fixo-item">
              <div className="fixo-icon entrada">↑</div>
              <div className="fixo-info">
                <div className="fixo-desc">{f.descricao}</div>
                <div className="fixo-meta">{FixoMeta(f)}</div>
              </div>
              <div className="fixo-valor entrada">{fmtBRL(f.valor)}</div>
              <button
                className="fixo-delete"
                onClick={() => removeFixo(f.id)}
                aria-label={`Remover ${f.descricao}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Saídas */}
      <div className="section-title">Saídas recorrentes</div>
      {saidas.length === 0 ? (
        <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>Nenhuma saída fixa cadastrada.</p>
      ) : (
        <div className="fixos-list">
          {saidas.map((f) => (
            <div key={f.id} className="fixo-item">
              <div className="fixo-icon saida">↓</div>
              <div className="fixo-info">
                <div className="fixo-desc">{f.descricao}</div>
                <div className="fixo-meta">{FixoMeta(f)}</div>
              </div>
              <div className="fixo-valor saida">{fmtBRL(f.valor)}</div>
              <button
                className="fixo-delete"
                onClick={() => removeFixo(f.id)}
                aria-label={`Remover ${f.descricao}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
