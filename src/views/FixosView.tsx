import { useState } from 'react'
import { useStore } from '../store'
import type { Fixo } from '../types'
import { fmtBRL, MONTH_NAMES, yyyymmStr } from '../calculations'

const NOW = new Date()
const TODAY_YEAR = NOW.getFullYear()
const TODAY_MONTH = NOW.getMonth() + 1
const TODAY_YYYYMM = yyyymmStr(TODAY_YEAR, TODAY_MONTH)

const ANOS_INICIO = Array.from({ length: 6 }, (_, i) => TODAY_YEAR - 2 + i)
const ANOS_FIM    = Array.from({ length: 8 }, (_, i) => TODAY_YEAR - 1 + i)

const emptyForm = {
  tipo: 'saida' as 'entrada' | 'saida',
  dia: 1,
  valor: '',
  descricao: '',
  inicioMes: TODAY_MONTH,
  inicioAno: TODAY_YEAR,
  fimMes: null as number | null,
  fimAno: null as number | null,
}

function parseYYYYMM(yyyy: number, mm: number): string {
  return `${yyyy}-${String(mm).padStart(2, '0')}`
}

function formatMeta(f: Fixo) {
  const start = f.inicio
    ? `${MONTH_NAMES[parseInt(f.inicio.slice(5)) - 1].slice(0, 3)}/${f.inicio.slice(0, 4)}`
    : ''
  const end = f.fim
    ? `${MONTH_NAMES[parseInt(f.fim.slice(5)) - 1].slice(0, 3)}/${f.fim.slice(0, 4)}`
    : 'sem fim'
  return `Dia ${f.dia} · ${start} → ${end}`
}

// ─── Linha editável de um fixo ───────────────────────────────────────────────
function FixoRow({ f }: { f: Fixo }) {
  const updateFixo = useStore((s) => s.updateFixo)
  const removeFixo = useStore((s) => s.removeFixo)
  const [editing, setEditing] = useState(false)

  const [inicioY, inicioM] = (f.inicio ?? TODAY_YYYYMM).split('-').map(Number)
  const [fimY, fimM] = f.fim ? f.fim.split('-').map(Number) : [null, null]

  if (editing) {
    return (
      <div className="fixo-edit-card">
        <div className="fixo-edit-row">
          {/* Tipo */}
          <select className="fixo-edit-sel" value={f.tipo}
            onChange={(e) => updateFixo(f.id, { tipo: e.target.value as 'entrada' | 'saida' })}>
            <option value="entrada">↑ Entrada</option>
            <option value="saida">↓ Saída</option>
          </select>
          {/* Descrição */}
          <input className="fixo-edit-desc" value={f.descricao}
            placeholder="Descrição"
            onChange={(e) => updateFixo(f.id, { descricao: e.target.value })} />
          {/* Valor */}
          <input className="fixo-edit-valor" type="number" min="0" step="0.01"
            value={f.valor || ''}
            placeholder="0,00 (opcional)"
            onChange={(e) => updateFixo(f.id, { valor: parseFloat(e.target.value) || 0 })} />
          {/* Dia */}
          <select className="fixo-edit-sel fixo-edit-dia" value={f.dia}
            onChange={(e) => updateFixo(f.id, { dia: Number(e.target.value) })}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>Dia {d}</option>
            ))}
          </select>
        </div>
        <div className="fixo-edit-row fixo-edit-row-dates">
          <span className="fixo-edit-label">Início</span>
          <select className="fixo-edit-sel" value={inicioM}
            onChange={(e) => updateFixo(f.id, { inicio: parseYYYYMM(inicioY, Number(e.target.value)) })}>
            {MONTH_NAMES.map((n, i) => <option key={i + 1} value={i + 1}>{n.slice(0, 3)}</option>)}
          </select>
          <select className="fixo-edit-sel" value={inicioY}
            onChange={(e) => updateFixo(f.id, { inicio: parseYYYYMM(Number(e.target.value), inicioM) })}>
            {ANOS_INICIO.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          <span className="fixo-edit-label" style={{ marginLeft: 12 }}>Fim</span>
          <select className="fixo-edit-sel" value={fimM ?? ''}
            onChange={(e) => {
              const m = Number(e.target.value)
              updateFixo(f.id, { fim: m ? parseYYYYMM(fimY ?? TODAY_YEAR, m) : null })
            }}>
            <option value="">Sem fim</option>
            {MONTH_NAMES.map((n, i) => <option key={i + 1} value={i + 1}>{n.slice(0, 3)}</option>)}
          </select>
          {fimM && (
            <select className="fixo-edit-sel" value={fimY ?? TODAY_YEAR}
              onChange={(e) => updateFixo(f.id, { fim: parseYYYYMM(Number(e.target.value), fimM) })}>
              {ANOS_FIM.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}

          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 13 }}
            onClick={() => setEditing(false)}>Feito</button>
          <button className="fixo-delete" onClick={() => removeFixo(f.id)}
            title={`Remover ${f.descricao}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixo-item" onClick={() => setEditing(true)} style={{ cursor: 'pointer' }}>
      <div className={`fixo-icon ${f.tipo}`}>{f.tipo === 'entrada' ? '↑' : '↓'}</div>
      <div className="fixo-info">
        <div className="fixo-desc">{f.descricao || <em style={{ opacity: 0.4 }}>sem descrição</em>}</div>
        <div className="fixo-meta">{formatMeta(f)}</div>
      </div>
      <div className={`fixo-valor ${f.tipo}`}>
        {f.valor > 0 ? fmtBRL(f.valor) : <span style={{ color: 'var(--ink-faint)', fontSize: 13 }}>a definir</span>}
      </div>
      <button className="fixo-edit-btn" title="Editar" onClick={(e) => { e.stopPropagation(); setEditing(true) }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
      <button
        className="fixo-delete"
        title="Remover"
        onClick={(e) => {
          e.stopPropagation()
          if (confirm(`Remover "${f.descricao}"?`)) removeFixo(f.id)
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" />
        </svg>
      </button>
    </div>
  )
}

// ─── View principal ───────────────────────────────────────────────────────────
export default function FixosView() {
  const { fixos, addFixo } = useStore()
  const [form, setForm] = useState(emptyForm)
  const [adding, setAdding] = useState(false)

  const entradas = fixos.filter((f) => f.tipo === 'entrada')
  const saidas = fixos.filter((f) => f.tipo === 'saida')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.descricao.trim()) return
    const valor = parseFloat(String(form.valor).replace(',', '.')) || 0
    addFixo({
      tipo: form.tipo,
      dia: Number(form.dia),
      valor,
      descricao: form.descricao.trim(),
      inicio: parseYYYYMM(form.inicioAno, form.inicioMes),
      fim: form.fimMes && form.fimAno ? parseYYYYMM(form.fimAno, form.fimMes) : null,
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

      {/* Formulário de adição */}
      {adding && (
        <form className="form-card" onSubmit={handleSubmit}>
          <div className="form-title">Novo lançamento fixo</div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="tipo">Tipo</label>
              <select id="tipo" className="input input-select" value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as 'entrada' | 'saida' })}>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="dia">Dia do mês</label>
              <select id="dia" className="input input-select" value={form.dia}
                onChange={(e) => setForm({ ...form, dia: parseInt(e.target.value) || 1 })}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="valor">Valor (R$) <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}>opcional</span></label>
              <input id="valor" type="number" min="0" step="0.01" className="input"
                placeholder="0,00"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })} />
            </div>
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label htmlFor="descricao">Descrição</label>
              <input id="descricao" type="text" className="input"
                placeholder="Ex.: Aluguel, Salário…"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                required maxLength={60} />
            </div>

            {/* Início */}
            <div className="field">
              <label>Início</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select className="input input-select" value={form.inicioMes}
                  onChange={(e) => setForm({ ...form, inicioMes: Number(e.target.value) })}>
                  {MONTH_NAMES.map((n, i) => <option key={i + 1} value={i + 1}>{n.slice(0, 3)}</option>)}
                </select>
                <select className="input input-select" value={form.inicioAno}
                  onChange={(e) => setForm({ ...form, inicioAno: Number(e.target.value) })}>
                  {ANOS_INICIO.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Fim */}
            <div className="field">
              <label>Fim <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}>opcional</span></label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select className="input input-select" value={form.fimMes ?? ''}
                  onChange={(e) => setForm({ ...form, fimMes: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Sem fim</option>
                  {MONTH_NAMES.map((n, i) => <option key={i + 1} value={i + 1}>{n.slice(0, 3)}</option>)}
                </select>
                {form.fimMes && (
                  <select className="input input-select" value={form.fimAno ?? TODAY_YEAR}
                    onChange={(e) => setForm({ ...form, fimAno: Number(e.target.value) })}>
                    {ANOS_FIM.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="submit" className="btn btn-primary">Salvar</button>
            <button type="button" className="btn btn-secondary"
              onClick={() => { setAdding(false); setForm(emptyForm) }}>Cancelar</button>
          </div>
        </form>
      )}

      {/* Entradas */}
      <div className="section-title">Entradas recorrentes</div>
      {entradas.length === 0 ? (
        <p style={{ color: 'var(--ink-faint)', fontSize: 13, marginBottom: 24 }}>Nenhuma entrada fixa cadastrada.</p>
      ) : (
        <div className="fixos-list">
          {entradas.map((f) => <FixoRow key={f.id} f={f} />)}
        </div>
      )}

      {/* Saídas */}
      <div className="section-title">Saídas recorrentes</div>
      {saidas.length === 0 ? (
        <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>Nenhuma saída fixa cadastrada.</p>
      ) : (
        <div className="fixos-list">
          {saidas.map((f) => <FixoRow key={f.id} f={f} />)}
        </div>
      )}

      <p style={{ marginTop: 24, fontSize: 12, color: 'var(--ink-faint)' }}>
        Clique em qualquer lançamento para editar. Valor é opcional — sem valor, o lançamento serve como lembrete.
      </p>
    </div>
  )
}
