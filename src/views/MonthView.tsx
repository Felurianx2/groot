import { useMemo, useRef } from 'react'
import { useStore } from '../store'
import {
  getMonthRows,
  getStartSaldoForMonth,
  getMonthSummary,
  getSaldoStatus,
  getDiarioTotal,
  fmtBRL,
  MONTH_NAMES,
} from '../calculations'
import type { DayEntry } from '../types'
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
  const reservaMinima = useStore((s) => s.reservaMinima)
  const saldoInicial = useStore((s) => s.saldoInicial)
  const economia = useStore((s) => s.economia)
  const notasAno = useStore((s) => s.notasAno)
  const horizonteMeses = useStore((s) => s.horizonteMeses)
  const tableRef = useRef<HTMLTableElement>(null)

  const data = useMemo(
    () => ({ saldoInicial, reservaMinima, horizonteMeses, dias, fixos, economia, notasAno }),
    [saldoInicial, reservaMinima, horizonteMeses, dias, fixos, economia, notasAno],
  )

  const startSaldo = useMemo(() => {
    const cache = new Map<string, number>()
    return getStartSaldoForMonth(currentYear, currentMonth, data, TODAY, cache)
  }, [currentYear, currentMonth, data])

  const rows = useMemo(
    () => getMonthRows(currentYear, currentMonth, startSaldo, dias, fixos, TODAY),
    [currentYear, currentMonth, startSaldo, dias, fixos],
  )

  const yyyymm = `${currentYear}-${String(currentMonth).padStart(2, '0')}`
  const economiaDoMes = economia[yyyymm] ?? 0
  const summary = useMemo(
    () => getMonthSummary(rows, startSaldo, economiaDoMes),
    [rows, startSaldo, economiaDoMes],
  )

  const isCurrentMonth = currentYear === TODAY_YEAR && currentMonth === TODAY_MONTH

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

  const saldoFinalStatus = getSaldoStatus(summary.saldoFinal, reservaMinima)
  const perfPositive = summary.performance >= 0

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
        <StatusBadge status={saldoFinalStatus} />
      </div>

      {/* Summary cards */}
      <div className="cards">
        <div className="card">
          <div className="card-label">Entradas</div>
          <div className="card-value green">{fmtBRL(summary.totalEntradas)}</div>
        </div>
        <div className="card">
          <div className="card-label">Saídas</div>
          <div className="card-value">{fmtBRL(summary.totalSaidas)}</div>
        </div>
        <div className="card">
          <div className="card-label">Diário</div>
          <div className="card-value">{fmtBRL(summary.totalDiario)}</div>
        </div>
        <div className="card">
          <div className="card-label">Saída Total</div>
          <div className="card-value">{fmtBRL(summary.saidaTotal)}</div>
        </div>
        {summary.economia > 0 && (
          <div className="card">
            <div className="card-label">Economia</div>
            <div className="card-value" style={{ color: 'var(--primary)' }}>−{fmtBRL(summary.economia)}</div>
          </div>
        )}
        <div className="card">
          <div className="card-label">Performance</div>
          <div className={`card-value ${perfPositive ? 'green' : 'red'}`}>
            {perfPositive ? '+' : ''}{fmtBRL(summary.performance)}
          </div>
        </div>
        <div className="card">
          <div className="card-label">Saldo Final</div>
          <div className={`card-value ${saldoFinalStatus}`}>{fmtBRL(summary.saldoFinal)}</div>
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
            {rows.map((row) => {
              const isToday = isCurrentMonth && row.day === TODAY_DAY
              const status = getSaldoStatus(row.saldo, reservaMinima)
              return (
                <tr key={row.day} className={isToday ? 'today-row' : ''}>
                  <td className="day-col">
                    <span className={`day-num${isToday ? ' today' : ''}`}>{row.day}</span>
                  </td>
                  <td className="cell-with-note">
                    <CellInput
                      value={row.entrada}
                      isProjected={row.entradaIsProjected}
                      onChange={(v) => handleChange(row.date, 'entrada', v)}
                      onMoveNext={getNext(row.day, 'entrada')}
                      onMovePrev={getPrev(row.day, 'entrada')}
                    />
                    <NoteField
                      nota={dias[row.date]?.entradaNota}
                      onChange={(n) => updateDayNota(row.date, 'entrada', n)}
                    />
                    <span data-day={row.day} data-field="entrada" style={{ display: 'none' }} />
                  </td>
                  <td className="cell-with-note">
                    <CellInput
                      value={row.saida}
                      isProjected={row.saidaIsProjected}
                      onChange={(v) => handleChange(row.date, 'saida', v)}
                      onMoveNext={getNext(row.day, 'saida')}
                      onMovePrev={getPrev(row.day, 'saida')}
                    />
                    <NoteField
                      nota={dias[row.date]?.saidaNota}
                      onChange={(n) => updateDayNota(row.date, 'saida', n)}
                    />
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
