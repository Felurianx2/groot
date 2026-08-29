import { useEffect, useState, useMemo } from 'react'
import { fetchSharedBudget } from '../lib/share'
import {
  getMonthRows,
  getStartSaldoForMonth,
  getMonthSummary,
  getSaldoStatus,
  getDiarioTotal,
  fmtBRL,
  fmtBRLCompact,
  MONTH_NAMES,
  yyyymmStr,
  daysInMonth,
  dateStr,
} from '../calculations'
import type { AppData, Projeto, ProjetoItem } from '../types'
import logo from '/groot-ui.png'

// ─── Cálculos de parcelas (espelho de ProjetosView) ───────────────────────────
function addMonthsP(yyyy: number, mm: number, n: number): [number, number] {
  const total = mm - 1 + n
  return [yyyy + Math.floor(total / 12), (total % 12) + 1]
}
function mmLabelP(y: number, m: number) {
  return `${MONTH_NAMES[m - 1].slice(0, 3)}/${String(y).slice(2)}`
}

function gerarParcelas(item: ProjetoItem): { mm: string; valor: number; label: string }[] {
  const parcelas = item.parcelas ?? 1
  const inicio = item.parcelaInicio
  if (!inicio) return []
  const valorParcela = item.valor / parcelas
  const freq = item.frequencia ?? 'mensal'
  if (freq === 'semanal') {
    const base = new Date(inicio + 'T12:00:00')
    return Array.from({ length: parcelas }, (_, i) => {
      const d = new Date(base)
      d.setDate(d.getDate() + i * 7)
      const y = d.getFullYear(), m = d.getMonth() + 1
      return { mm: yyyymmStr(y, m), valor: valorParcela, label: mmLabelP(y, m) }
    })
  }
  const [iy, im] = inicio.split('-').map(Number)
  return Array.from({ length: parcelas }, (_, i) => {
    const [y, m] = addMonthsP(iy, im, i)
    return { mm: yyyymmStr(y, m), valor: valorParcela, label: mmLabelP(y, m) }
  })
}

function calcTimeline(projeto: Projeto): Map<string, number> {
  const map = new Map<string, number>()
  for (const item of projeto.itens) {
    for (const p of gerarParcelas(item)) {
      map.set(p.mm, (map.get(p.mm) ?? 0) + p.valor)
    }
  }
  return map
}

const NOW = new Date()
const TODAY = NOW.toISOString().slice(0, 10)
const THIS_YEAR = NOW.getFullYear()
const THIS_MONTH = NOW.getMonth() + 1

// ─── Navegação de meses ───────────────────────────────────────────────────────
function prevM(y: number, m: number): [number, number] {
  return m === 1 ? [y - 1, 12] : [y, m - 1]
}
function nextM(y: number, m: number): [number, number] {
  return m === 12 ? [y + 1, 1] : [y, m + 1]
}

// ─── Visão mensal read-only ───────────────────────────────────────────────────
function MonthReadOnly({ data, year, month }: { data: AppData; year: number; month: number }) {
  const cache = useMemo(() => new Map<string, number>(), [data])

  const startSaldo = useMemo(
    () => getStartSaldoForMonth(year, month, data, TODAY, cache),
    [year, month, data],
  )

  const rows = useMemo(
    () => getMonthRows(year, month, startSaldo, data.dias, data.fixos, TODAY),
    [year, month, startSaldo, data],
  )

  const summary = useMemo(() => getMonthSummary(rows, startSaldo), [rows, startSaldo])
  const status = getSaldoStatus(summary.saldoFinal, data.reservaMinima)
  const perfPos = summary.performance >= 0

  const isCurrentMonth = year === THIS_YEAR && month === THIS_MONTH
  const todayDay = NOW.getDate()

  // Fixos do mês
  const mm = yyyymmStr(year, month)
  const fixosByDate = useMemo(() => {
    const map = new Map<string, { entradas: typeof data.fixos; saidas: typeof data.fixos }>()
    const totalDias = daysInMonth(year, month)
    for (const f of data.fixos) {
      if (f.inicio > mm) continue
      if (f.fim !== null && f.fim < mm) continue
      const day = Math.min(f.dia, totalDias)
      const date = dateStr(year, month, day)
      const bucket = map.get(date) ?? { entradas: [], saidas: [] }
      if (f.tipo === 'entrada') bucket.entradas.push(f)
      else bucket.saidas.push(f)
      map.set(date, bucket)
    }
    return map
  }, [data.fixos, year, month])

  return (
    <>
      {/* Cards resumo */}
      <div className="cards">
        <div className="card">
          <div className="card-label">Entradas</div>
          <div className="card-value green">{fmtBRL(summary.totalEntradas)}</div>
        </div>
        <div className="card">
          <div className="card-label">Saídas Fixas</div>
          <div className="card-value">{fmtBRL(summary.totalSaidas)}</div>
        </div>
        <div className="card">
          <div className="card-label">Diário</div>
          <div className="card-value">{fmtBRL(summary.totalDiario)}</div>
        </div>
        <div className="card">
          <div className="card-label">Performance</div>
          <div className={`card-value ${perfPos ? 'green' : 'red'}`}>
            {perfPos ? '+' : ''}{fmtBRL(summary.performance)}
          </div>
        </div>
        <div className="card">
          <div className="card-label">Saldo Final</div>
          <div className={`card-value ${status}`}>{fmtBRL(summary.saldoFinal)}</div>
        </div>
      </div>

      {/* Tabela de dias */}
      <div className="grid-wrap" style={{ marginBottom: 0 }}>
        <table className="day-grid">
          <thead>
            <tr>
              <th>Dia</th>
              <th style={{ textAlign: 'right' }}>Entrada</th>
              <th style={{ textAlign: 'right' }}>Saída</th>
              <th style={{ textAlign: 'right' }}>Diário</th>
              <th style={{ textAlign: 'right' }}>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isToday = isCurrentMonth && row.day === todayDay
              const rowStatus = getSaldoStatus(row.saldo, data.reservaMinima)
              const dayFixos = fixosByDate.get(row.date)
              const diario = getDiarioTotal(data.dias[row.date])
              const hasData = row.entrada > 0 || row.saida > 0 || diario > 0
              if (!hasData && !dayFixos && !isToday) {
                // Linha vazia — mostra só saldo
                return (
                  <tr key={row.day} style={{ opacity: 0.4 }}>
                    <td className="day-col">
                      <span className="day-num">{row.day}</span>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--ink-faint)', fontSize: 13 }}>—</td>
                    <td style={{ textAlign: 'right', color: 'var(--ink-faint)', fontSize: 13 }}>—</td>
                    <td style={{ textAlign: 'right', color: 'var(--ink-faint)', fontSize: 13 }}>—</td>
                    <td>
                      <div className={`saldo-cell ${rowStatus}`}>{fmtBRL(row.saldo)}</div>
                    </td>
                  </tr>
                )
              }
              return (
                <tr key={row.day} className={isToday ? 'today-row' : ''}>
                  <td className="day-col">
                    <span className={`day-num${isToday ? ' today' : ''}`}>{row.day}</span>
                  </td>
                  <td style={{ textAlign: 'right', verticalAlign: 'top', paddingTop: 10 }}>
                    {row.entrada > 0 && (
                      <span style={{ color: 'var(--green)', fontWeight: 600, fontSize: 13 }}>
                        {row.entradaIsProjected ? <em>{fmtBRL(row.entrada)}</em> : fmtBRL(row.entrada)}
                      </span>
                    )}
                    {dayFixos?.entradas.map((f) => (
                      <div key={f.id} className="fixo-day-chip entrada" style={{ display: 'block', marginTop: 3 }}>
                        {f.descricao}{f.valor > 0 ? ` · ${fmtBRL(f.valor)}` : ''}
                      </div>
                    ))}
                  </td>
                  <td style={{ textAlign: 'right', verticalAlign: 'top', paddingTop: 10 }}>
                    {row.saida > 0 && (
                      <span style={{ fontWeight: 600, fontSize: 13 }}>
                        {row.saidaIsProjected ? <em>{fmtBRL(row.saida)}</em> : fmtBRL(row.saida)}
                      </span>
                    )}
                    {dayFixos?.saidas.map((f) => (
                      <div key={f.id} className="fixo-day-chip saida" style={{ display: 'block', marginTop: 3 }}>
                        {f.descricao}{f.valor > 0 ? ` · ${fmtBRL(f.valor)}` : ''}
                      </div>
                    ))}
                  </td>
                  <td style={{ textAlign: 'right', verticalAlign: 'top', paddingTop: 10 }}>
                    {diario > 0 && (
                      <span style={{ fontSize: 13 }}>{fmtBRL(diario)}</span>
                    )}
                    {data.dias[row.date]?.diarioItens?.map((it) => (
                      <div key={it.id} style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 2 }}>
                        {it.nota} · {fmtBRL(it.valor)}
                      </div>
                    ))}
                  </td>
                  <td>
                    <div className={`saldo-cell ${rowStatus}`}>{fmtBRL(row.saldo)}</div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-faint)' }}>
        Saldo inicial do mês: {fmtBRL(startSaldo)} · <em>Itálico</em> = valor projetado
      </p>
    </>
  )
}

// ─── Visão anual resumida ─────────────────────────────────────────────────────
function YearReadOnly({ data, year }: { data: AppData; year: number }) {
  const cache = useMemo(() => new Map<string, number>(), [data, year])

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const start = getStartSaldoForMonth(year, m, data, TODAY, cache)
      const rows = getMonthRows(year, m, start, data.dias, data.fixos, TODAY)
      const summary = getMonthSummary(rows, start)
      const status = getSaldoStatus(summary.saldoFinal, data.reservaMinima)
      return { m, label: MONTH_NAMES[i].slice(0, 3), summary, status }
    })
  }, [data, year])

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ink-muted)' }}>Mês</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ink-muted)' }}>Entradas</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ink-muted)' }}>Saídas</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ink-muted)' }}>Performance</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ink-muted)' }}>Saldo Final</th>
          </tr>
        </thead>
        <tbody>
          {months.map(({ m, label, summary, status }) => {
            const isCurrent = year === THIS_YEAR && m === THIS_MONTH
            const perfPos = summary.performance >= 0
            return (
              <tr key={m} style={{
                borderBottom: '1px solid var(--border)',
                background: isCurrent ? 'color-mix(in oklch, var(--primary) 6%, transparent)' : undefined,
              }}>
                <td style={{ padding: '10px 12px', fontWeight: isCurrent ? 700 : 400 }}>
                  {label} {isCurrent && <span style={{ fontSize: 10, color: 'var(--primary)', marginLeft: 4 }}>hoje</span>}
                </td>
                <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--green)' }}>
                  {fmtBRLCompact(summary.totalEntradas)}
                </td>
                <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--ink-muted)' }}>
                  {fmtBRLCompact(summary.saidaTotal)}
                </td>
                <td style={{ textAlign: 'right', padding: '10px 12px', color: perfPos ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                  {perfPos ? '+' : ''}{fmtBRLCompact(summary.performance)}
                </td>
                <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                  <span className={`saldo-cell ${status}`} style={{ float: 'right' }}>
                    {fmtBRLCompact(summary.saldoFinal)}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Fixos ativos ─────────────────────────────────────────────────────────────
function FixosReadOnly({ data }: { data: AppData }) {
  const mm = yyyymmStr(THIS_YEAR, THIS_MONTH)
  const fixosAtivos = data.fixos.filter(
    (f) => f.inicio <= mm && (f.fim === null || f.fim >= mm),
  )
  const entradas = fixosAtivos.filter((f) => f.tipo === 'entrada')
  const saidas = fixosAtivos.filter((f) => f.tipo === 'saida')

  if (fixosAtivos.length === 0) return <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>Nenhum fixo ativo.</p>

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {entradas.map((f) => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--green)', fontWeight: 700 }}>↑</span>
          <span style={{ flex: 1, fontSize: 14 }}>{f.descricao}</span>
          <span style={{ fontWeight: 600, color: 'var(--green)' }}>
            {f.valor > 0 ? fmtBRL(f.valor) : <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>a definir</span>}
          </span>
          <span style={{ fontSize: 11, color: 'var(--ink-faint)', minWidth: 40, textAlign: 'right' }}>Dia {f.dia}</span>
        </div>
      ))}
      {saidas.map((f) => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--red)', fontWeight: 700 }}>↓</span>
          <span style={{ flex: 1, fontSize: 14 }}>{f.descricao}</span>
          <span style={{ fontWeight: 500, color: 'var(--ink-muted)' }}>
            {f.valor > 0 ? fmtBRL(f.valor) : <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>a definir</span>}
          </span>
          <span style={{ fontSize: 11, color: 'var(--ink-faint)', minWidth: 40, textAlign: 'right' }}>Dia {f.dia}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Projetos read-only ───────────────────────────────────────────────────────
function ProjetosReadOnly({ data }: { data: AppData }) {
  const projetos = (data.projetos ?? []).filter((p) => !p.concluido)
  const concluidos = (data.projetos ?? []).filter((p) => p.concluido)
  const todayMm = yyyymmStr(THIS_YEAR, THIS_MONTH)

  if (projetos.length === 0 && concluidos.length === 0) {
    return <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>Nenhum projeto cadastrado.</p>
  }

  function renderProjeto(p: Projeto) {
    const total = p.itens.reduce((s, i) => s + i.valor, 0)
    const timeline = calcTimeline(p)
    const entries = Array.from(timeline.entries()).sort(([a], [b]) => a.localeCompare(b))

    return (
      <div key={p.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', flex: 1 }}>{p.nome}</span>
          {p.prazo && (
            <span style={{ fontSize: 12, color: 'var(--ink-muted)', background: 'var(--surface-2)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)' }}>
              Prazo: {new Date(p.prazo + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', day: '2-digit' })}
            </span>
          )}
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink-muted)' }}>{fmtBRL(total)}</span>
        </div>

        {/* Itens */}
        <div style={{ display: 'grid', gap: 6, marginBottom: entries.length > 0 ? 14 : 0 }}>
          {p.itens.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '6px 10px', borderRadius: 8, background: 'var(--bg)' }}>
              <span style={{ flex: 1, color: 'var(--ink)' }}>{item.nome}</span>
              <span style={{ color: 'var(--ink-muted)', fontSize: 12 }}>
                {(item.parcelas ?? 1) > 1
                  ? `${item.parcelas}× ${fmtBRL(item.valor / (item.parcelas ?? 1))}/${(item.frequencia ?? 'mensal') === 'semanal' ? 'sem' : 'mês'}`
                  : 'à vista'}
              </span>
              <span style={{ fontWeight: 600 }}>{fmtBRL(item.valor)}</span>
            </div>
          ))}
        </div>

        {/* Timeline por mês */}
        {entries.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ink-muted)', marginBottom: 8 }}>
              Parcelas por mês
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {entries.map(([mm, valor]) => {
                const [y, m] = mm.split('-').map(Number)
                const isPast = mm < todayMm
                const isCurrent = mm === todayMm
                return (
                  <div key={mm} style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: isCurrent
                      ? 'color-mix(in oklch, var(--primary) 15%, transparent)'
                      : isPast ? 'var(--surface-2)' : 'var(--bg)',
                    border: `1px solid ${isCurrent ? 'var(--primary)' : 'var(--border)'}`,
                    color: isPast ? 'var(--ink-faint)' : isCurrent ? 'var(--primary)' : 'var(--ink)',
                  }}>
                    {mmLabelP(y, m)} · {fmtBRL(valor)}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {projetos.map(renderProjeto)}
      {concluidos.length > 0 && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--ink-muted)', fontSize: 13, marginBottom: 12 }}>
            {concluidos.length} concluído{concluidos.length > 1 ? 's' : ''}
          </summary>
          <div style={{ opacity: 0.6 }}>
            {concluidos.map(renderProjeto)}
          </div>
        </details>
      )}
    </div>
  )
}

// ─── Shell da visão compartilhada ─────────────────────────────────────────────
type SharedTab = 'mes' | 'ano' | 'fixos' | 'projetos'

function SharedShell({ data }: { data: AppData }) {
  const [tab, setTab] = useState<SharedTab>('mes')
  const [year, setYear] = useState(THIS_YEAR)
  const [month, setMonth] = useState(THIS_MONTH)

  function goPrev() {
    const [y, m] = prevM(year, month)
    setYear(y); setMonth(m)
  }
  function goNext() {
    const [y, m] = nextM(year, month)
    setYear(y); setMonth(m)
  }

  const tabs: { id: SharedTab; label: string }[] = [
    { id: 'mes', label: 'Mês' },
    { id: 'ano', label: 'Ano' },
    { id: 'fixos', label: 'Fixos' },
    { id: 'projetos', label: 'Projetos' },
  ]

  return (
    <div className="shared-view">
      {/* Header */}
      <div className="shared-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={logo} alt="Groot" style={{ width: 28, height: 28, borderRadius: 8 }} />
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.03em' }}>Groot</span>
          <span style={{ color: 'var(--ink-faint)', fontSize: 13, marginLeft: 4 }}>· visão compartilhada</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
          Somente leitura · {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {tabs.map((t) => (
          <button key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 16px', fontSize: 14, fontWeight: tab === t.id ? 600 : 400,
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t.id ? 'var(--primary)' : 'var(--ink-muted)',
              borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -1, borderRadius: 0, transition: 'color 150ms',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Mês */}
      {tab === 'mes' && (
        <>
          <div className="view-header">
            <div className="month-nav">
              <button className="nav-btn" onClick={goPrev}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', minWidth: 186, textAlign: 'center' }}>
                {MONTH_NAMES[month - 1]} {year}
              </h2>
              <button className="nav-btn" onClick={goNext}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
          <MonthReadOnly data={data} year={year} month={month} />
        </>
      )}

      {/* Ano */}
      {tab === 'ano' && (
        <>
          <div className="view-header">
            <div className="month-nav">
              <button className="nav-btn" onClick={() => setYear((y) => y - 1)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', minWidth: 80, textAlign: 'center' }}>
                {year}
              </h2>
              <button className="nav-btn" onClick={() => setYear((y) => y + 1)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
          <div className="grid-wrap" style={{ marginBottom: 0 }}>
            <YearReadOnly data={data} year={year} />
          </div>
        </>
      )}

      {/* Fixos */}
      {tab === 'fixos' && (
        <>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, letterSpacing: '-0.02em' }}>
            Lançamentos Fixos Ativos
          </h2>
          <FixosReadOnly data={data} />
        </>
      )}

      {/* Projetos */}
      {tab === 'projetos' && (
        <>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, letterSpacing: '-0.02em' }}>
            Projetos
          </h2>
          <ProjetosReadOnly data={data} />
        </>
      )}

      <div style={{ marginTop: 40, padding: '12px 0', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--ink-faint)', textAlign: 'center' }}>
        Visão somente leitura gerada pelo <strong>Groot</strong>. Os dados são do titular da conta.
      </div>
    </div>
  )
}

// ─── Export principal ─────────────────────────────────────────────────────────
export default function SharedView({ token }: { token: string }) {
  const [data, setData] = useState<AppData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetchSharedBudget(token).then((d) => {
      setLoading(false)
      if (!d) setNotFound(true)
      else setData(d)
    })
  }, [token])

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--ink-faint)', fontSize: 14 }}>Carregando…</div>
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: 12 }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Link inválido ou revogado</div>
        <div style={{ color: 'var(--ink-faint)', fontSize: 14 }}>Este link não existe ou o acesso foi revogado pelo titular.</div>
      </div>
    )
  }

  return <SharedShell data={data} />
}
