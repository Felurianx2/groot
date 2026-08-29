import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../lib/auth'
import {
  upsertProfile, getCasalStatus, sendInvite,
  acceptInvite, cancelInvite, loadPartnerBudget,
} from '../lib/casal'
import type { CasalStatus } from '../lib/casal'
import type { AppData, DayEntry } from '../types'
import { usePartnerStore } from '../partnerStore'
import { useStore } from '../store'
import {
  getStartSaldoForMonth, getMonthRows, getMonthSummary,
  getSaldoStatus, fmtBRL, MONTH_NAMES, yyyymmStr,
} from '../calculations'

const TODAY = new Date().toISOString().slice(0, 10)
const NOW   = new Date()

type ViewMode = 'partner' | 'combined'

function prevM(y: number, m: number): [number, number] { return m === 1 ? [y - 1, 12] : [y, m - 1] }
function nextM(y: number, m: number): [number, number] { return m === 12 ? [y + 1, 1] : [y, m + 1] }

// Extrai descrições de um DayEntry
function entryDescs(entry: DayEntry | undefined) {
  if (!entry) return { entrada: '', saida: '', diario: [] as string[] }
  return {
    entrada: entry.entradaNota ?? '',
    saida: entry.saidaNota ?? '',
    diario: (entry.diarioItens ?? []).filter(i => i.nota).map(i => `${i.nota}: ${fmtBRL(i.valor)}`),
  }
}

// ─── Sumário de um mês para um AppData ────────────────────────────────────────
function useMonthData(data: AppData, year: number, month: number) {
  return useMemo(() => {
    const cache = new Map<string, number>()
    const normalizedData = { ...data, fixos: data.fixos ?? [], dias: data.dias ?? {}, projetos: data.projetos ?? [] }
    const start = getStartSaldoForMonth(year, month, normalizedData, TODAY, cache)
    const rows  = getMonthRows(year, month, start, normalizedData.dias, normalizedData.fixos, TODAY)
    const sum   = getMonthSummary(rows, start)
    return { rows, summary: sum, startSaldo: start }
  }, [data, year, month])
}

// ─── Tabela dia a dia (read-only, com descrições) ─────────────────────────────
function DayTable({ data, year, month, label }: { data: AppData; year: number; month: number; label?: string }) {
  const { rows } = useMonthData(data, year, month)
  const active = rows.filter(r => r.entrada > 0 || r.saida > 0 || r.diario > 0)
  if (!active.length) return <p style={{ fontSize: 13, color: 'var(--ink-faint)', margin: '8px 0 16px' }}>Sem lançamentos em {MONTH_NAMES[month - 1]}.</p>

  return (
    <div className="grid-wrap" style={{ marginTop: 8 }}>
      {label && <div className="section-title" style={{ marginBottom: 6, fontSize: 12 }}>{label}</div>}
      <table className="day-grid">
        <thead>
          <tr>
            <th>Dia</th><th>Entrada</th><th>Saída</th><th>Diário</th><th>Saldo</th>
          </tr>
        </thead>
        <tbody>
          {active.map(row => {
            const entry = data.dias[row.date]
            const descs = entryDescs(entry)
            const st = getSaldoStatus(row.saldo, data.reservaMinima)
            return (
              <tr key={row.day}>
                <td className="day-col"><span className="day-num">{row.day}</span></td>
                <td>
                  {row.entrada > 0 ? (
                    <div>
                      <span style={{ color: 'var(--green)', fontWeight: 500 }}>{fmtBRL(row.entrada)}</span>
                      {descs.entrada && <div className="casal-desc">{descs.entrada}</div>}
                    </div>
                  ) : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                </td>
                <td>
                  {row.saida > 0 ? (
                    <div>
                      <span style={{ fontWeight: 500 }}>{fmtBRL(row.saida)}</span>
                      {descs.saida && <div className="casal-desc">{descs.saida}</div>}
                    </div>
                  ) : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                </td>
                <td>
                  {row.diario > 0 ? (
                    <div>
                      <span style={{ fontWeight: 500 }}>{fmtBRL(row.diario)}</span>
                      {descs.diario.map((d, i) => <div key={i} className="casal-desc">{d}</div>)}
                    </div>
                  ) : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                </td>
                <td><div className={`saldo-cell ${st}`}>{fmtBRL(row.saldo)}</div></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Cards de resumo ──────────────────────────────────────────────────────────
function SummaryCards({ totalEntradas, saidaTotal, performance, saldoFinal, reservaMinima, compact }: {
  totalEntradas: number; totalSaidas?: number; totalDiario?: number
  saidaTotal: number; performance: number; saldoFinal: number | null
  reservaMinima: number; compact?: boolean
}) {
  const saldoStatus = saldoFinal !== null ? getSaldoStatus(saldoFinal, reservaMinima) : null
  return (
    <div className={compact ? 'casal-cards-compact' : 'cards'}>
      <div className={compact ? 'casal-card-sm' : 'card'}>
        <div className="card-label">Entradas</div>
        <div className={compact ? 'casal-val green' : 'card-value green'}>{fmtBRL(totalEntradas)}</div>
      </div>
      <div className={compact ? 'casal-card-sm' : 'card'}>
        <div className="card-label">Saídas</div>
        <div className={compact ? 'casal-val' : 'card-value'}>{fmtBRL(saidaTotal)}</div>
      </div>
      <div className={compact ? 'casal-card-sm' : 'card'}>
        <div className="card-label">Performance</div>
        <div className={`${compact ? 'casal-val' : 'card-value'} ${performance >= 0 ? 'green' : 'red'}`}>
          {performance >= 0 ? '+' : ''}{fmtBRL(performance)}
        </div>
      </div>
      {saldoFinal !== null && saldoStatus && (
        <div className={compact ? 'casal-card-sm' : 'card'}>
          <div className="card-label">Saldo Final</div>
          <div className={`${compact ? 'casal-val' : 'card-value'} ${saldoStatus}`}>{fmtBRL(saldoFinal)}</div>
        </div>
      )}
    </div>
  )
}

// ─── Visão combinada ──────────────────────────────────────────────────────────
function CombinedView({ myData, partnerData, partnerEmail }: { myData: AppData; partnerData: AppData; partnerEmail?: string }) {
  const [year, setYear]   = useState(NOW.getFullYear())
  const [month, setMonth] = useState(NOW.getMonth() + 1)

  const my      = useMonthData(myData, year, month)
  const partner = useMonthData(partnerData, year, month)

  const combined = useMemo(() => ({
    totalEntradas: my.summary.totalEntradas + partner.summary.totalEntradas,
    totalSaidas:   my.summary.totalSaidas   + partner.summary.totalSaidas,
    totalDiario:   my.summary.totalDiario   + partner.summary.totalDiario,
    saidaTotal:    my.summary.saidaTotal    + partner.summary.saidaTotal,
    performance:   my.summary.performance   + partner.summary.performance,
  }), [my.summary, partner.summary])

  return (
    <div>
      {/* Nav */}
      <div className="casal-partner-header">
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-muted)' }}>Combinado</span>
        <div className="month-nav" style={{ gap: 8 }}>
          <button className="nav-btn" onClick={() => { const [y,m] = prevM(year, month); setYear(y); setMonth(m) }} aria-label="Mês anterior">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{MONTH_NAMES[month - 1]} {year}</span>
          <button className="nav-btn" onClick={() => { const [y,m] = nextM(year, month); setYear(y); setMonth(m) }} aria-label="Próximo mês">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      {/* Cards combinados */}
      <div className="cards">
        <div className="card">
          <div className="card-label">Entradas totais</div>
          <div className="card-value green">{fmtBRL(combined.totalEntradas)}</div>
        </div>
        <div className="card">
          <div className="card-label">Saídas totais</div>
          <div className="card-value">{fmtBRL(combined.saidaTotal)}</div>
        </div>
        <div className="card">
          <div className="card-label">Performance combinada</div>
          <div className={`card-value ${combined.performance >= 0 ? 'green' : 'red'}`}>
            {combined.performance >= 0 ? '+' : ''}{fmtBRL(combined.performance)}
          </div>
        </div>
      </div>

      {/* Separação por pessoa */}
      <div className="casal-split">
        {/* Eu */}
        <div className="casal-split-col">
          <div className="casal-split-header">Eu</div>
          <SummaryCards {...my.summary} reservaMinima={myData.reservaMinima} compact />
          <DayTable data={myData} year={year} month={month} />
        </div>
        {/* Parceiro(a) */}
        <div className="casal-split-col">
          <div className="casal-split-header">{partnerEmail?.split('@')[0] ?? 'Parceiro(a)'}</div>
          <SummaryCards {...partner.summary} reservaMinima={partnerData.reservaMinima} compact />
          <DayTable data={partnerData} year={year} month={month} />
        </div>
      </div>
    </div>
  )
}

// ─── Visão só parceiro(a) ─────────────────────────────────────────────────────
function PartnerOnlyView({ data, email }: { data: AppData; email?: string }) {
  const [year, setYear]   = useState(NOW.getFullYear())
  const [month, setMonth] = useState(NOW.getMonth() + 1)
  const { summary }       = useMonthData(data, year, month)
  const mm = yyyymmStr(year, month)
  const fixosAtivos = (data.fixos ?? []).filter(f => f.inicio <= mm && (f.fim === null || f.fim >= mm))

  return (
    <div className="casal-partner-budget">
      <div className="casal-partner-header">
        <span className="casal-partner-email">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          {email ?? 'Parceiro(a)'}
        </span>
        <div className="month-nav" style={{ gap: 8 }}>
          <button className="nav-btn" onClick={() => { const [y,m] = prevM(year, month); setYear(y); setMonth(m) }} aria-label="Mês anterior">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{MONTH_NAMES[month - 1]} {year}</span>
          <button className="nav-btn" onClick={() => { const [y,m] = nextM(year, month); setYear(y); setMonth(m) }} aria-label="Próximo mês">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      {/* Resumo */}
      <SummaryCards {...summary} reservaMinima={data.reservaMinima} saldoFinal={summary.saldoFinal} />

      {/* Lançamentos com descrições */}
      <DayTable data={data} year={year} month={month} />

      {/* Fixos */}
      {fixosAtivos.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div className="section-title" style={{ fontSize: 12, marginBottom: 8 }}>Fixos de {email?.split('@')[0] ?? 'parceiro(a)'}</div>
          {fixosAtivos.map(f => (
            <div key={f.id} className="casal-fixo-row">
              <span className={`fixo-icon ${f.tipo}`}>{f.tipo === 'entrada' ? '↑' : '↓'}</span>
              <span className="casal-fixo-desc">{f.descricao}</span>
              <span className={`fixo-valor ${f.tipo}`}>{f.valor > 0 ? fmtBRL(f.valor) : <em style={{ opacity: 0.4 }}>a definir</em>}</span>
              <span className="casal-fixo-meta">Dia {f.dia}</span>
            </div>
          ))}
        </div>
      )}

      {/* Projetos compartilhados */}
      {(() => {
        const shared = data.projetos?.filter(p => p.compartilhado && !p.concluido) ?? []
        if (!shared.length) return null
        return (
          <div style={{ marginTop: 20 }}>
            <div className="section-title" style={{ fontSize: 12, marginBottom: 8 }}>Projetos compartilhados</div>
            {shared.map(p => (
              <div key={p.id} className="casal-projeto-row">
                <span style={{ fontWeight: 600, fontSize: 13 }}>{p.nome}</span>
                {p.prazo && <span className="casal-fixo-meta">Prazo: {p.prazo}</span>}
                <div style={{ marginTop: 4 }}>
                  {p.itens.map(i => (
                    <div key={i.id} className="casal-projeto-item">
                      <span>{i.nome}</span>
                      <span style={{ color: 'var(--ink-muted)' }}>{fmtBRL(i.valor)}{(i.parcelas ?? 1) > 1 ? ` (${i.parcelas}x)` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}

// ─── View principal ───────────────────────────────────────────────────────────
export default function CasalView() {
  const { user } = useAuth()
  const myData   = useStore(s => ({
    saldoInicial: s.saldoInicial, reservaMinima: s.reservaMinima,
    horizonteMeses: s.horizonteMeses, dias: s.dias, fixos: s.fixos,
    economia: s.economia, notasAno: s.notasAno, projetos: s.projetos,
  }))
  const { setPartner, clearPartner, partnerBudget, partnerEmail } = usePartnerStore()

  const [status, setStatus]           = useState<CasalStatus | null>(null)
  const [loading, setLoading]         = useState(true)
  const [viewMode, setViewMode]       = useState<ViewMode>('partner')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [sending, setSending]         = useState(false)

  async function refresh() {
    setLoading(true)
    await upsertProfile()
    const s = await getCasalStatus()
    setStatus(s)
    if (s.type === 'connected' && s.partnerId) {
      const budget = await loadPartnerBudget(s.partnerId)
      setPartner(budget, s.partnerEmail, s.partnerId)
    } else {
      clearPartner()
    }
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setSending(true)
    setInviteError('')
    const result = await sendInvite(inviteEmail)
    if (!result.ok) { setInviteError(result.error ?? 'Erro ao enviar convite.'); setSending(false); return }
    await refresh()
    setSending(false)
  }

  async function handleAccept() {
    if (!status?.invite) return
    const ok = await acceptInvite(status.invite.id)
    if (ok) await refresh()
  }

  async function handleCancel() {
    if (!status?.invite) return
    if (!confirm(status.type === 'sent-pending' ? 'Cancelar convite?' : 'Rejeitar convite?')) return
    await cancelInvite(status.invite.id)
    await refresh()
  }

  async function handleDisconnect() {
    if (!status?.invite) return
    if (!confirm('Desconectar do orçamento compartilhado?')) return
    await cancelInvite(status.invite.id)
    clearPartner()
    await refresh()
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <span style={{ color: 'var(--ink-faint)', fontSize: 14 }}>Carregando…</span>
    </div>
  )

  return (
    <div>
      <div className="view-header">
        <h1 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.03em' }}>Casal</h1>
        {status?.type === 'connected' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className={`btn-projeto-toggle${viewMode === 'partner' ? ' active' : ''}`}
              onClick={() => setViewMode('partner')}
            >
              {partnerEmail?.split('@')[0] ?? 'Parceiro(a)'}
            </button>
            <button
              className={`btn-projeto-toggle${viewMode === 'combined' ? ' active' : ''}`}
              onClick={() => setViewMode('combined')}
              disabled={!partnerBudget}
              title={!partnerBudget ? 'Parceiro(a) sem dados ainda' : 'Ver orçamentos combinados'}
            >
              Combinado
            </button>
            <button className="btn btn-danger" style={{ fontSize: 12, padding: '4px 12px' }} onClick={handleDisconnect}>
              Desconectar
            </button>
          </div>
        )}
      </div>

      {/* ── Sem convite ── */}
      {status?.type === 'none' && (
        <div className="casal-card">
          <div className="casal-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h2 className="casal-empty-title">Conecte com seu parceiro(a)</h2>
          <p className="casal-empty-desc">
            Compartilhe o orçamento com outra pessoa. Cada um mantém seu login e dados independentes
            — você verá o resumo mensal e os projetos compartilhados.
          </p>
          <form className="casal-invite-form" onSubmit={handleSendInvite}>
            <input type="email" className="input" placeholder="Email do parceiro(a)"
              value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required />
            <button type="submit" className="btn btn-primary" disabled={sending}>
              {sending ? 'Enviando…' : 'Enviar convite'}
            </button>
          </form>
          {inviteError && <p className="casal-error">{inviteError}</p>}
        </div>
      )}

      {/* ── Convite enviado ── */}
      {status?.type === 'sent-pending' && (
        <div className="casal-card">
          <div className="casal-status-icon pending">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <h2 className="casal-empty-title" style={{ fontSize: 16 }}>Aguardando resposta</h2>
          <p className="casal-empty-desc">
            Convite enviado para <strong>{status.partnerEmail}</strong>.<br />
            Peça para abrir o Groot → aba Casal → Aceitar.
          </p>
          <button className="btn btn-secondary" onClick={handleCancel}>Cancelar convite</button>
        </div>
      )}

      {/* ── Convite recebido ── */}
      {status?.type === 'received-pending' && (
        <div className="casal-card">
          <div className="casal-status-icon received">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </div>
          <h2 className="casal-empty-title" style={{ fontSize: 16 }}>Convite recebido</h2>
          <p className="casal-empty-desc">
            <strong>{status.partnerEmail ?? 'Alguém'}</strong> quer compartilhar o orçamento com você.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={handleAccept}>✓ Aceitar</button>
            <button className="btn btn-secondary" onClick={handleCancel}>Rejeitar</button>
          </div>
        </div>
      )}

      {/* ── Conectados ── */}
      {status?.type === 'connected' && partnerBudget && viewMode === 'combined' && (
        <CombinedView myData={myData} partnerData={partnerBudget} partnerEmail={partnerEmail ?? undefined} />
      )}
      {status?.type === 'connected' && partnerBudget && viewMode === 'partner' && (
        <PartnerOnlyView data={partnerBudget} email={partnerEmail ?? undefined} />
      )}
      {status?.type === 'connected' && !partnerBudget && (
        <div className="casal-card">
          <p className="casal-empty-desc">
            Conectado com <strong>{partnerEmail}</strong>, mas o(a) parceiro(a) ainda não tem dados salvos.
          </p>
        </div>
      )}

      <p style={{ marginTop: 24, fontSize: 12, color: 'var(--ink-faint)' }}>Logado como: {user?.email}</p>
    </div>
  )
}
