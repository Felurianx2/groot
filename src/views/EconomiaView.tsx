import { useMemo } from 'react'
import { useStore } from '../store'
import {
  getStartSaldoForMonth,
  getMonthRows,
  getMonthSummary,
  fmtBRL,
  MONTH_NAMES,
  yyyymmStr,
} from '../calculations'

const TODAY = new Date().toISOString().slice(0, 10)

function fmtPct(num: number, den: number): string {
  if (!den || den <= 0) return '—'
  return `${((num / den) * 100).toFixed(1)}%`
}

export default function EconomiaView() {
  const currentYear = useStore((s) => s.currentYear)
  const setCurrentMonth = useStore((s) => s.setCurrentMonth)
  const economia = useStore((s) => s.economia)
  const notasAno = useStore((s) => s.notasAno)
  const setEconomia = useStore((s) => s.setEconomia)
  const setNotaAno = useStore((s) => s.setNotaAno)
  const saldoInicial = useStore((s) => s.saldoInicial)
  const reservaMinima = useStore((s) => s.reservaMinima)
  const horizonteMeses = useStore((s) => s.horizonteMeses)
  const dias = useStore((s) => s.dias)
  const fixos = useStore((s) => s.fixos)
  const projetos = useStore((s) => s.projetos)
  const year = currentYear

  const data = useMemo(
    () => ({ saldoInicial, reservaMinima, horizonteMeses, dias, fixos, economia, notasAno, projetos }),
    [saldoInicial, reservaMinima, horizonteMeses, dias, fixos, economia, notasAno, projetos],
  )

  const monthData = useMemo(() => {
    const cache = new Map<string, number>()
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const mm = yyyymmStr(year, m)
      const startSaldo = getStartSaldoForMonth(year, m, data, TODAY, cache)
      const rows = getMonthRows(year, m, startSaldo, data.dias, data.fixos, TODAY)
      const summary = getMonthSummary(rows, startSaldo)
      const eco = economia[mm] ?? 0
      return { month: m, mm, name: MONTH_NAMES[i], entradas: summary.totalEntradas, eco }
    })
  }, [year, data, economia])

  const totalEntradas = monthData.reduce((s, m) => s + m.entradas, 0)
  const totalEco = monthData.reduce((s, m) => s + m.eco, 0)
  const nota = notasAno[String(year)] ?? ''

  return (
    <div>
      <div className="view-header" style={{ justifyContent: 'space-between' }}>
        <div className="month-nav">
          <button
            className="nav-btn"
            onClick={() => { setCurrentMonth(year - 1, 1); }}
            aria-label="Ano anterior"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1>Economia — {year}</h1>
          <button
            className="nav-btn"
            onClick={() => { setCurrentMonth(year + 1, 1); }}
            aria-label="Próximo ano"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="economia-table-wrap">
        <table className="economia-table">
          <thead>
            <tr>
              <th scope="col">Mês</th>
              <th scope="col">Entradas</th>
              <th scope="col">Economia</th>
              <th scope="col">%</th>
            </tr>
          </thead>
          <tbody>
            {monthData.map((m) => (
              <tr key={m.month}>
                <td>{m.name}</td>
                <td style={{ color: 'var(--green)' }}>{fmtBRL(m.entradas)}</td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input"
                    style={{ textAlign: 'right', maxWidth: 130, padding: '4px 8px', fontSize: 13 }}
                    value={m.eco || ''}
                    placeholder="0,00"
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      setEconomia(m.mm, isNaN(v) ? 0 : v)
                    }}
                    aria-label={`Economia de ${m.name}`}
                  />
                </td>
                <td>
                  <span className="pct">{fmtPct(m.eco, m.entradas)}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total {year}</td>
              <td style={{ color: 'var(--green)' }}>{fmtBRL(totalEntradas)}</td>
              <td>{fmtBRL(totalEco)}</td>
              <td><span className="pct">{fmtPct(totalEco, totalEntradas)}</span></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="nota-wrap">
        <label htmlFor="nota-anual">Nota do ano {year}</label>
        <textarea
          id="nota-anual"
          className="nota-textarea"
          placeholder="Ex.: Toda a reserva foi utilizada para reforma..."
          value={nota}
          onChange={(e) => setNotaAno(String(year), e.target.value)}
          rows={3}
        />
      </div>
    </div>
  )
}
