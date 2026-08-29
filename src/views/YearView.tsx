import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useStore } from '../store'
import {
  getStartSaldoForMonth,
  getMonthRows,
  getMonthSummary,
  getSaldoStatus,
  fmtBRL,
  fmtBRLCompact,
  MONTH_NAMES,
} from '../calculations'
import StatusBadge from '../components/StatusBadge'

const TODAY = new Date().toISOString().slice(0, 10)
const TODAY_MONTH = new Date().getMonth() + 1
const TODAY_YEAR = new Date().getFullYear()

export default function YearView() {
  const currentYear = useStore((s) => s.currentYear)
  const currentMonth = useStore((s) => s.currentMonth)
  const setCurrentMonth = useStore((s) => s.setCurrentMonth)
  const setActiveView = useStore((s) => s.setActiveView)
  const saldoInicial = useStore((s) => s.saldoInicial)
  const reservaMinima = useStore((s) => s.reservaMinima)
  const horizonteMeses = useStore((s) => s.horizonteMeses)
  const dias = useStore((s) => s.dias)
  const fixos = useStore((s) => s.fixos)
  const projetos = useStore((s) => s.projetos)
  const economia = useStore((s) => s.economia)
  const notasAno = useStore((s) => s.notasAno)
  const year = currentYear

  const data = useMemo(
    () => ({ saldoInicial, reservaMinima, horizonteMeses, dias, fixos, economia, notasAno, projetos }),
    [saldoInicial, reservaMinima, horizonteMeses, dias, fixos, economia, notasAno, projetos],
  )

  const monthData = useMemo(() => {
    const cache = new Map<string, number>()
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const startSaldo = getStartSaldoForMonth(year, m, data, TODAY, cache)
      const rows = getMonthRows(year, m, startSaldo, data.dias, data.fixos, TODAY)
      const summary = getMonthSummary(rows, startSaldo)
      return {
        month: m,
        name: MONTH_NAMES[i].slice(0, 3),
        fullName: MONTH_NAMES[i],
        ...summary,
        status: getSaldoStatus(summary.saldoFinal, data.reservaMinima),
      }
    })
  }, [year, data])

  const chartData = monthData.map((m) => ({
    name: m.name,
    saldo: m.saldoFinal,
    status: m.status,
  }))

  function goToMonth(m: number) {
    setCurrentMonth(year, m)
    setActiveView('month')
  }

  const statusColors = {
    green: 'var(--green)',
    yellow: 'var(--yellow)',
    red: 'var(--red)',
  }

  return (
    <div>
      <div className="view-header">
        <div className="month-nav">
          <button className="nav-btn" onClick={() => setCurrentMonth(year - 1, currentMonth)} aria-label="Ano anterior">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1>{year}</h1>
          <button className="nav-btn" onClick={() => setCurrentMonth(year + 1, currentMonth)} aria-label="Próximo ano">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="chart-wrap" style={{ marginBottom: 24 }}>
        <div className="chart-title">Saldo Final — {year}</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tickFormatter={fmtBRLCompact}
              tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
              axisLine={false} tickLine={false} width={72}
            />
            <Tooltip
              formatter={(v) => [fmtBRL(Number(v)), 'Saldo']}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 13,
                color: 'var(--ink)',
              }}
              cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
            />
            <ReferenceLine y={0} stroke="var(--red)" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="saldo"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={(props: any) => {
                const { cx, cy, payload } = props
                const color = statusColors[payload.status as keyof typeof statusColors]
                return <circle key={cx} cx={cx} cy={cy} r={4} fill={color} stroke="var(--bg)" strokeWidth={2} />
              }}
              activeDot={{ r: 6, fill: 'var(--primary)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Month table */}
      <div className="year-table-wrap">
        <table className="year-table">
          <thead>
            <tr>
              <th scope="col">Mês</th>
              <th scope="col">Entradas</th>
              <th scope="col">Saídas</th>
              <th scope="col">Diário</th>
              <th scope="col">Performance</th>
              <th scope="col">Saldo Final</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {monthData.map((m) => {
              const isCurrentM = year === TODAY_YEAR && m.month === TODAY_MONTH
              return (
                <tr
                  key={m.month}
                  className={isCurrentM ? 'current-month' : ''}
                  onClick={() => goToMonth(m.month)}
                  title={`Ir para ${m.fullName}`}
                >
                  <td>{m.fullName}</td>
                  <td className="pos">{fmtBRL(m.totalEntradas)}</td>
                  <td>{fmtBRL(m.totalSaidas)}</td>
                  <td>{fmtBRL(m.totalDiario)}</td>
                  <td className={m.performance >= 0 ? 'pos' : 'neg'}>
                    {m.performance >= 0 ? '+' : ''}{fmtBRL(m.performance)}
                  </td>
                  <td className={m.status}>
                    <strong>{fmtBRL(m.saldoFinal)}</strong>
                  </td>
                  <td><StatusBadge status={m.status} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
