import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import {
  getMonthRows,
  getStartSaldoForMonth,
  getMonthSummary,
  getSaldoStatus,
  getDiarioTotal,
  fmtBRL,
  MONTH_NAMES,
  daysInMonth,
  dateStr,
} from '../calculations'
import type { DayEntry, Fixo } from '../types'
import CellInput from '../components/CellInput'
import NoteField from '../components/NoteField'
import DiarioCell from '../components/DiarioCell'
import StatusBadge from '../components/StatusBadge'

const TODAY = new Date().toISOString().slice(0, 10)
const TODAY_DAY = new Date().getDate()
const TODAY_MONTH = new Date().getMonth() + 1
const TODAY_YEAR = new Date().getFullYear()

function prevM(y: number, m: number) { return m === 1 ? [y - 1, 12] : [y, m - 1] }
function nextM(y: number, m: number) { return m === 12 ? [y + 1, 1] : [y, m + 1] }

export default function MonthView() {
  const currentYear = useStore((s) => s.currentYear)
  const currentMonth = useStore((s) => s.currentMonth)
  const setCurrentMonth = useStore((s) => s.setCurrentMonth)
  const updateDay = useStore((s) => s.updateDay)
  const updateDayNota = useStore((s) => s.updateDayNota)
  const addDiarioItem = useStore((s) => s.addDiarioItem)
  const updateDiarioItem = useStore((s) => s.updateDiarioItem)
  const removeDiarioItem = useStore((s) => s.removeDiarioItem)
  const dias = useStore((s) => s.dias)
  const fixos = useStore((s) => s.fixos)
  const projetos = useStore((s) => s.projetos)
  const reservaMinima = useStore((s) => s.reservaMinima)
  const saldoInicial = useStore((s) => s.saldoInicial)
  const economia = useStore((s) => s.economia)
  const notasAno = useStore((s) => s.notasAno)
  const horizonteMeses = useStore((s) => s.horizonteMeses)
  const tableRef = useRef<HTMLTableElement>(null)

  const [showProjetos, setShowProjetos] = useState<boolean>(() => {
    try { return localStorage.getItem('groot-show-projetos') === '1' } catch { return false }
  })

  function toggleProjetos() {
    setShowProjetos(v => {
      const next = !v
      try { localStorage.setItem('groot-show-projetos', next ? '1' : '0') } catch {}
      return next
    })
  }

  const data = useMemo(
    () => ({ saldoInicial, reservaMinima, horizonteMeses, dias, fixos, economia, notasAno, projetos }),
    [saldoInicial, reservaMinima, horizonteMeses, dias, fixos, economia, notasAno, projetos],
  )

  const startSaldo = useMemo(() => {
    const cache = new Map<string, number>()
    return getStartSaldoForMonth(currentYear, currentMonth, data, TODAY, cache)
  }, [currentYear, currentMonth, data])

  const rows = useMemo(
    () => getMonthRows(currentYear, currentMonth, startSaldo, dias, fixos, TODAY),
    [currentYear, currentMonth, startSaldo, dias, fixos],
  )

  const isCurrentMonth = currentYear === TODAY_YEAR && currentMonth === TODAY_MONTH

  // Mapa day → parcelas de projeto que caem naquele dia do mês atual
  const projetoChipsByDay = useMemo(() => {
    const map = new Map<number, { nome: string; item: string; valor: number }[]>()
    if (!showProjetos || !projetos?.length) return map
    for (const projeto of projetos) {
      if (projeto.concluido) continue
      for (const item of (projeto.itens ?? [])) {
        if (!item.parcelaInicio || item.valor <= 0) continue
        const parcelas = item.parcelas ?? 1
        const freq = item.frequencia ?? 'mensal'
        const valorParcela = item.valor / parcelas
        if (freq === 'semanal' && item.parcelaInicio.length === 10) {
          const base = new Date(item.parcelaInicio + 'T12:00:00')
          for (let i = 0; i < parcelas; i++) {
            const d = new Date(base)
            d.setDate(d.getDate() + i * 7)
            if (d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth) {
              const day = d.getDate()
              const arr = map.get(day) ?? []
              arr.push({ nome: projeto.nome, item: item.nome, valor: valorParcela })
              map.set(day, arr)
            }
          }
        } else if (item.parcelaInicio.length >= 7) {
          const [iy, im] = item.parcelaInicio.slice(0, 7).split('-').map(Number)
          for (let p = 0; p < parcelas; p++) {
            const total = (im - 1) + p
            const y = iy + Math.floor(total / 12)
            const m = (total % 12) + 1
            if (y === currentYear && m === currentMonth) {
              const arr = map.get(1) ?? []
              arr.push({ nome: projeto.nome, item: item.nome, valor: valorParcela })
              map.set(1, arr)
              break
            }
          }
        }
      }
    }
    return map
  }, [projetos, currentYear, currentMonth, showProjetos])

  // Soma de projeto saída por dia (agrega todos os chips do dia)
  const projetoSaidaByDay = useMemo(() => {
    const map = new Map<number, number>()
    projetoChipsByDay.forEach((chips, day) => {
      map.set(day, chips.reduce((acc, c) => acc + c.valor, 0))
    })
    return map
  }, [projetoChipsByDay])

  // Rows ajustados: quando showProjetos=true, soma parcelas de projeto na saída
  // e recalcula o saldo corrido a partir do startSaldo
  const adjustedRows = useMemo(() => {
    if (!showProjetos || projetoSaidaByDay.size === 0) return rows
    let runningSaldo = startSaldo
    return rows.map(row => {
      const extra = projetoSaidaByDay.get(row.day) ?? 0
      const saida = row.saida + extra
      runningSaldo = runningSaldo + row.entrada - saida - row.diario
      return { ...row, saida, saldo: runningSaldo }
    })
  }, [rows, projetoSaidaByDay, showProjetos, startSaldo])

  // Resumo recalculado com os adjustedRows
  const adjustedSummary = useMemo(
    () => getMonthSummary(adjustedRows, startSaldo),
    [adjustedRows, startSaldo],
  )

  // Mapa date → fixos aplicáveis naquele dia do mês
  const fixosByDate = useMemo(() => {
    const mm = `${currentYear}-${String(currentMonth).padStart(2, '0')}`
    const map = new Map<string, { entradas: Fixo[]; saidas: Fixo[] }>()
    const totalDias = daysInMonth(currentYear, currentMonth)
    for (const f of fixos) {
      if (f.inicio > mm) continue
      if (f.fim !== null && f.fim < mm) continue
      const day = Math.min(f.dia, totalDias)
      const date = dateStr(currentYear, currentMonth, day)
      const bucket = map.get(date) ?? { entradas: [], saidas: [] }
      if (f.tipo === 'entrada') bucket.entradas.push(f)
      else bucket.saidas.push(f)
      map.set(date, bucket)
    }
    return map
  }, [fixos, currentYear, currentMonth])

  function goToPrev() {
    const [y, m] = prevM(currentYear, currentMonth)
    setCurrentMonth(y, m)
  }
  function goToNext() {
    const [y, m] = nextM(currentYear, currentMonth)
    setCurrentMonth(y, m)
  }

  function handleChange(date: string, field: keyof DayEntry, value: number) {
    updateDay(date, field, value === 0 ? undefined : value)
  }

  function focusCell(day: number, field: 'entrada' | 'saida' | 'diario') {
    const btn = tableRef.current?.querySelector<HTMLElement>(
      `[data-day="${day}"][data-field="${field}"]`,
    )
    btn?.focus()
    ;(btn as HTMLButtonElement | null)?.click()
  }

  function getNext(day: number, field: 'entrada' | 'saida' | 'diario') {
    const order: ('entrada' | 'saida' | 'diario')[] = ['entrada', 'saida', 'diario']
    const idx = order.indexOf(field)
    if (idx < 2) return () => focusCell(day, order[idx + 1])
    if (day < rows.length) return () => focusCell(day + 1, 'entrada')
    return undefined
  }

  function getPrev(day: number, field: 'entrada' | 'saida' | 'diario') {
    const order: ('entrada' | 'saida' | 'diario')[] = ['entrada', 'saida', 'diario']
    const idx = order.indexOf(field)
    if (idx > 0) return () => focusCell(day, order[idx - 1])
    if (day > 1) return () => focusCell(day - 1, 'diario')
    return undefined
  }

  const saldoFinalStatus = getSaldoStatus(adjustedSummary.saldoFinal, reservaMinima)
  const perfPositive = adjustedSummary.performance >= 0

  return (
    <div>
      {/* Header */}
      <div className="view-header">
        <div className="month-nav">
          <button className="nav-btn" onClick={goToPrev} aria-label="Mês anterior">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1>{MONTH_NAMES[currentMonth - 1]} {currentYear}</h1>
          <button className="nav-btn" onClick={goToNext} aria-label="Próximo mês">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {projetos && projetos.some(p => !p.concluido && p.itens.length > 0) && (
            <button
              className={`btn-projeto-toggle${showProjetos ? ' active' : ''}`}
              onClick={toggleProjetos}
              title={showProjetos ? 'Ocultar parcelas de projetos' : 'Mostrar parcelas de projetos'}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Projetos
            </button>
          )}
          <StatusBadge status={saldoFinalStatus} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="cards">
        <div className="card">
          <div className="card-label">Entradas</div>
          <div className="card-value green">{fmtBRL(adjustedSummary.totalEntradas)}</div>
        </div>
        <div className="card">
          <div className="card-label">Saídas</div>
          <div className="card-value">{fmtBRL(adjustedSummary.totalSaidas)}</div>
        </div>
        <div className="card">
          <div className="card-label">Diário</div>
          <div className="card-value">{fmtBRL(adjustedSummary.totalDiario)}</div>
        </div>
        <div className="card">
          <div className="card-label">Saída Total</div>
          <div className="card-value">{fmtBRL(adjustedSummary.saidaTotal)}</div>
        </div>
        <div className="card">
          <div className="card-label">Performance</div>
          <div className={`card-value ${perfPositive ? 'green' : 'red'}`}>
            {perfPositive ? '+' : ''}{fmtBRL(adjustedSummary.performance)}
          </div>
        </div>
        <div className="card">
          <div className="card-label">Saldo Final</div>
          <div className={`card-value ${saldoFinalStatus}`}>{fmtBRL(adjustedSummary.saldoFinal)}</div>
        </div>
      </div>

      {/* Day grid */}
      <div className="grid-wrap">
        <table className="day-grid" ref={tableRef}>
          <thead>
            <tr>
              <th scope="col">Dia</th>
              <th scope="col">Entrada</th>
              <th scope="col">Saída</th>
              <th scope="col">Diário</th>
              <th scope="col">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {adjustedRows.map((row, idx) => {
              const origRow = rows[idx]   // valores originais (sem projeto) para o CellInput
              const isToday = isCurrentMonth && row.day === TODAY_DAY
              const status = getSaldoStatus(row.saldo, reservaMinima)
              return (
                <tr key={row.day} className={isToday ? 'today-row' : ''}>
                  <td className="day-col">
                    <span className={`day-num${isToday ? ' today' : ''}`}>{row.day}</span>
                  </td>
                  <td className="cell-with-note">
                    <CellInput
                      value={origRow.entrada}
                      isProjected={origRow.entradaIsProjected}
                      onChange={(v) => handleChange(row.date, 'entrada', v)}
                      onMoveNext={getNext(row.day, 'entrada')}
                      onMovePrev={getPrev(row.day, 'entrada')}
                    />
                    <NoteField
                      nota={dias[row.date]?.entradaNota}
                      onChange={(n) => updateDayNota(row.date, 'entrada', n)}
                    />
                    {fixosByDate.get(row.date)?.entradas.map((f) => (
                      <span key={f.id} className="fixo-day-chip entrada">
                        {f.descricao}{f.valor > 0 ? ` · ${fmtBRL(f.valor)}` : ''}
                      </span>
                    ))}
                    <span data-day={row.day} data-field="entrada" style={{ display: 'none' }} />
                  </td>
                  <td className="cell-with-note">
                    <CellInput
                      value={origRow.saida}
                      isProjected={origRow.saidaIsProjected}
                      onChange={(v) => handleChange(row.date, 'saida', v)}
                      onMoveNext={getNext(row.day, 'saida')}
                      onMovePrev={getPrev(row.day, 'saida')}
                    />
                    <NoteField
                      nota={dias[row.date]?.saidaNota}
                      onChange={(n) => updateDayNota(row.date, 'saida', n)}
                    />
                    {fixosByDate.get(row.date)?.saidas.map((f) => (
                      <span key={f.id} className="fixo-day-chip saida">
                        {f.descricao}{f.valor > 0 ? ` · ${fmtBRL(f.valor)}` : ''}
                      </span>
                    ))}
                    {projetoChipsByDay.get(row.day)?.map((chip, idx) => (
                      <span key={idx} className="fixo-day-chip projeto">
                        {chip.nome} · {fmtBRL(chip.valor)}
                      </span>
                    ))}
                    <span data-day={row.day} data-field="saida" style={{ display: 'none' }} />
                  </td>
                  <td>
                    <DiarioCell
                      itens={dias[row.date]?.diarioItens ?? []}
                      total={getDiarioTotal(dias[row.date])}
                      onAdd={(item) => addDiarioItem(row.date, item)}
                      onUpdate={(id, partial) => updateDiarioItem(row.date, id, partial)}
                      onRemove={(id) => removeDiarioItem(row.date, id)}
                    />
                    <span data-day={row.day} data-field="diario" style={{ display: 'none' }} />
                  </td>
                  <td>
                    <div className={`saldo-cell ${status}`} aria-label={`Saldo dia ${row.day}: ${fmtBRL(row.saldo)} — ${status === 'green' ? 'ok' : status === 'yellow' ? 'atenção' : 'negativo'}`}>
                      {fmtBRL(row.saldo)}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Context info */}
      <p style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-faint)' }}>
        Saldo inicial do mês: {fmtBRL(startSaldo)}
        {' · '}
        <em style={{ fontStyle: 'italic' }}>Itálico</em> = valor projetado (fixo)
        {' · '}
        Reserva mínima: {fmtBRL(reservaMinima)}
      </p>
    </div>
  )
}
