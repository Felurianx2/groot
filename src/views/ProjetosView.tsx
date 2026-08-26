import { useState, useMemo } from 'react'
import { useStore } from '../store'
import {
  getStartSaldoForMonth,
  getMonthRows,
  getMonthSummary,
  fmtBRL,
  yyyymmStr,
  MONTH_NAMES,
} from '../calculations'
import type { Projeto, ProjetoItem } from '../types'

const TODAY = new Date().toISOString().slice(0, 10)
const NOW = new Date()
const TODAY_YEAR = NOW.getFullYear()
const TODAY_MONTH = NOW.getMonth() + 1

function addMonths(yyyy: number, mm: number, n: number): [number, number] {
  const total = mm - 1 + n
  return [yyyy + Math.floor(total / 12), (total % 12) + 1]
}

function mmLabel(yyyy: number, mm: number) {
  return `${MONTH_NAMES[mm - 1].slice(0, 3)}/${String(yyyy).slice(2)}`
}

// Gera lista de parcelas de um item
function gerarParcelas(item: ProjetoItem): { mm: string; valor: number; label: string }[] {
  const parcelas = item.parcelas ?? 1
  const inicio = item.parcelaInicio
  if (!inicio) return []
  const [iy, im] = inicio.split('-').map(Number)
  const valorParcela = item.valor / parcelas
  return Array.from({ length: parcelas }, (_, i) => {
    const [y, m] = addMonths(iy, im, i)
    return { mm: yyyymmStr(y, m), valor: valorParcela, label: mmLabel(y, m) }
  })
}

// Mapa de mm -> total de parcelas do projeto
function calcTimeline(projeto: Projeto): Map<string, number> {
  const map = new Map<string, number>()
  for (const item of projeto.itens) {
    for (const p of gerarParcelas(item)) {
      map.set(p.mm, (map.get(p.mm) ?? 0) + p.valor)
    }
  }
  return map
}

function useMediaMensal(n = 3) {
  const saldoInicial = useStore((s) => s.saldoInicial)
  const reservaMinima = useStore((s) => s.reservaMinima)
  const horizonteMeses = useStore((s) => s.horizonteMeses)
  const dias = useStore((s) => s.dias)
  const fixos = useStore((s) => s.fixos)
  const economia = useStore((s) => s.economia)
  const notasAno = useStore((s) => s.notasAno)
  const projetos = useStore((s) => s.projetos)

  return useMemo(() => {
    const data = { saldoInicial, reservaMinima, horizonteMeses, dias, fixos, economia, notasAno, projetos }
    const cache = new Map<string, number>()
    const performances: number[] = []
    for (let i = 1; i <= n; i++) {
      let y = TODAY_YEAR
      let m = TODAY_MONTH - i
      if (m <= 0) { m += 12; y -= 1 }
      const mm = yyyymmStr(y, m)
      const hasDados = Object.keys(dias).some((k) => k.startsWith(mm))
      if (!hasDados) continue
      const start = getStartSaldoForMonth(y, m, data, TODAY, cache)
      const rows = getMonthRows(y, m, start, dias, fixos, TODAY)
      performances.push(getMonthSummary(rows, start).performance)
    }
    if (performances.length === 0) return null
    return performances.reduce((a, b) => a + b, 0) / performances.length
  }, [saldoInicial, reservaMinima, horizonteMeses, dias, fixos, economia, notasAno, projetos])
}

function useSaldoAtual() {
  const saldoInicial = useStore((s) => s.saldoInicial)
  const reservaMinima = useStore((s) => s.reservaMinima)
  const horizonteMeses = useStore((s) => s.horizonteMeses)
  const dias = useStore((s) => s.dias)
  const fixos = useStore((s) => s.fixos)
  const economia = useStore((s) => s.economia)
  const notasAno = useStore((s) => s.notasAno)
  const projetos = useStore((s) => s.projetos)

  return useMemo(() => {
    const data = { saldoInicial, reservaMinima, horizonteMeses, dias, fixos, economia, notasAno, projetos }
    const cache = new Map<string, number>()
    const start = getStartSaldoForMonth(TODAY_YEAR, TODAY_MONTH, data, TODAY, cache)
    const rows = getMonthRows(TODAY_YEAR, TODAY_MONTH, start, dias, fixos, TODAY)
    const todayDay = NOW.getDate()
    const ate = rows.filter((r) => r.day <= todayDay)
    return ate.length > 0 ? ate[ate.length - 1].saldo : start
  }, [saldoInicial, reservaMinima, horizonteMeses, dias, fixos, economia, notasAno, projetos])
}

// ─── Item row ────────────────────────────────────────────────────────────────
function ItemRow({ item, projetoId }: { item: ProjetoItem; projetoId: string }) {
  const updateProjetoItem = useStore((s) => s.updateProjetoItem)
  const removeProjetoItem = useStore((s) => s.removeProjetoItem)
  const [expanded, setExpanded] = useState(false)

  const parcelas = item.parcelas ?? 1
  const valorParcela = item.valor / parcelas
  const timeline = gerarParcelas(item)
  const temParcelamento = parcelas > 1

  return (
    <div className="projeto-item-wrap">
      <div className="projeto-item-row">
        <input
          className="projeto-item-nome"
          value={item.nome}
          onChange={(e) => updateProjetoItem(projetoId, item.id, { nome: e.target.value })}
          placeholder="Descrição"
        />
        <input
          className="projeto-item-valor"
          type="number"
          min="0"
          step="0.01"
          value={item.valor || ''}
          onChange={(e) => updateProjetoItem(projetoId, item.id, { valor: parseFloat(e.target.value) || 0 })}
          placeholder="0,00"
        />
        {/* Parcelas */}
        <div className="projeto-parcela-wrap">
          <select
            className="projeto-parcela-sel"
            value={parcelas}
            onChange={(e) => {
              const n = Number(e.target.value)
              const inicio = n > 1 ? (item.parcelaInicio ?? yyyymmStr(TODAY_YEAR, TODAY_MONTH)) : undefined
              updateProjetoItem(projetoId, item.id, { parcelas: n, parcelaInicio: inicio })
            }}
            title="Número de parcelas"
          >
            {[1,2,3,4,5,6,7,8,9,10,11,12,18,24,36,48,60].map((n) => (
              <option key={n} value={n}>{n === 1 ? 'À vista' : `${n}x`}</option>
            ))}
          </select>
          {temParcelamento && (() => {
            const [iy, im] = (item.parcelaInicio ?? yyyymmStr(TODAY_YEAR, TODAY_MONTH)).split('-').map(Number)
            const anos = Array.from({ length: 6 }, (_, i) => TODAY_YEAR + i)
            return (
              <div className="projeto-parcela-mes-wrap">
                <select
                  className="projeto-parcela-mes-sel"
                  value={im}
                  onChange={(e) => updateProjetoItem(projetoId, item.id, { parcelaInicio: yyyymmStr(iy, Number(e.target.value)) })}
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>{name.slice(0, 3)}</option>
                  ))}
                </select>
                <select
                  className="projeto-parcela-ano-sel"
                  value={iy}
                  onChange={(e) => updateProjetoItem(projetoId, item.id, { parcelaInicio: yyyymmStr(Number(e.target.value), im) })}
                >
                  {anos.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )
          })()}
        </div>
        {temParcelamento && timeline.length > 0 && (
          <button
            className="projeto-parcela-toggle"
            onClick={() => setExpanded((v) => !v)}
            title="Ver cronograma"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: expanded ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}
        <button className="projeto-item-remove" onClick={() => removeProjetoItem(projetoId, item.id)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Parcela hint */}
      {temParcelamento && item.valor > 0 && (
        <div className="projeto-parcela-hint">
          {parcelas}x de {fmtBRL(valorParcela)}
          {timeline.length > 0 && ` · ${timeline[0].label} → ${timeline[timeline.length - 1].label}`}
        </div>
      )}

      {/* Cronograma expandido */}
      {expanded && timeline.length > 0 && (
        <div className="projeto-cronograma">
          {timeline.map((p, i) => (
            <div key={p.mm} className="projeto-crono-item">
              <span className="projeto-crono-n">{i + 1}/{parcelas}</span>
              <span className="projeto-crono-mm">{p.label}</span>
              <span className="projeto-crono-val">{fmtBRL(p.valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Projeto Card ─────────────────────────────────────────────────────────────
interface ProjetoCardProps {
  projeto: Projeto
  saldoAtual: number
  mediaMensal: number | null
}

function ProjetoCard({ projeto, saldoAtual, mediaMensal }: ProjetoCardProps) {
  const addProjetoItem = useStore((s) => s.addProjetoItem)
  const updateProjeto = useStore((s) => s.updateProjeto)
  const removeProjeto = useStore((s) => s.removeProjeto)

  const [novoNome, setNovoNome] = useState('')
  const [novoValor, setNovoValor] = useState('')
  const [editandoNome, setEditandoNome] = useState(false)
  const [nomeTemp, setNomeTemp] = useState(projeto.nome)

  // Total à vista (itens sem parcelamento ou sem início definido)
  const totalAvista = projeto.itens
    .filter((i) => (i.parcelas ?? 1) === 1 || !i.parcelaInicio)
    .reduce((s, i) => s + i.valor, 0)

  // Total parcelado (custo total de todos os itens com parcelas)
  const totalProjeto = projeto.itens.reduce((s, i) => s + i.valor, 0)

  // Timeline: mm -> total de parcelas naquele mês
  const timeline = useMemo(() => calcTimeline(projeto), [projeto])
  const timelineEntries = Array.from(timeline.entries()).sort(([a], [b]) => a.localeCompare(b))

  // Para projeção: considera custo à vista + parcela mais pesada no pior mês
  const maiorMes = timelineEntries.reduce((max, [, v]) => Math.max(max, v), 0)
  const custoEfetivo = totalAvista + maiorMes // o mês mais pesado

  const temSaldo = saldoAtual >= custoEfetivo
  const falta = Math.max(0, custoEfetivo - saldoAtual)

  let mesesEstimado: number | null = null
  let dataEstimada: string | null = null
  if (!temSaldo && mediaMensal && mediaMensal > 0) {
    mesesEstimado = Math.ceil(falta / mediaMensal)
    const alvo = new Date(NOW)
    alvo.setMonth(alvo.getMonth() + mesesEstimado)
    dataEstimada = alvo.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }

  let prazoStatus: 'ok' | 'risco' | 'impossivel' | null = null
  if (projeto.prazo && !temSaldo) {
    const prazoDate = new Date(projeto.prazo + 'T00:00:00')
    const mesesAtePrazo = Math.max(0,
      (prazoDate.getFullYear() - NOW.getFullYear()) * 12 + (prazoDate.getMonth() - NOW.getMonth())
    )
    if (mediaMensal && mediaMensal > 0) {
      const pode = mediaMensal * mesesAtePrazo
      prazoStatus = pode >= falta ? 'ok' : pode >= falta * 0.8 ? 'risco' : 'impossivel'
    } else {
      prazoStatus = 'impossivel'
    }
  }

  function salvarItem() {
    const nome = novoNome.trim()
    const valor = parseFloat(novoValor.replace(',', '.'))
    if (!nome || isNaN(valor) || valor <= 0) return
    addProjetoItem(projeto.id, { nome, valor, parcelas: 1 })
    setNovoNome('')
    setNovoValor('')
  }

  return (
    <div className="projeto-card">
      {/* Header */}
      <div className="projeto-header">
        {editandoNome ? (
          <input
            className="projeto-nome-input"
            value={nomeTemp}
            onChange={(e) => setNomeTemp(e.target.value)}
            onBlur={() => { updateProjeto(projeto.id, { nome: nomeTemp }); setEditandoNome(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { updateProjeto(projeto.id, { nome: nomeTemp }); setEditandoNome(false) } }}
            autoFocus
          />
        ) : (
          <h2 className="projeto-nome" onClick={() => { setNomeTemp(projeto.nome); setEditandoNome(true) }}>
            {projeto.nome}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 6, opacity: 0.4 }}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </h2>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label className="projeto-prazo-label">
            Prazo:
            <input
              type="date"
              className="projeto-prazo-input"
              value={projeto.prazo ?? ''}
              onChange={(e) => updateProjeto(projeto.id, { prazo: e.target.value || null })}
            />
          </label>
          <button
            className="projeto-remove-btn"
            onClick={() => { if (confirm(`Remover projeto "${projeto.nome}"?`)) removeProjeto(projeto.id) }}
            title="Remover projeto"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Itens */}
      <div className="projeto-itens">
        <div className="projeto-itens-header">
          <span>Despesa</span><span>Valor total</span><span>Parcelamento</span>
        </div>
        {projeto.itens.length === 0 && (
          <p className="projeto-empty">Adicione as despesas do projeto abaixo.</p>
        )}
        {projeto.itens.map((item) => (
          <ItemRow key={item.id} item={item} projetoId={projeto.id} />
        ))}

        {/* Adicionar item */}
        <div className="projeto-add-row">
          <input
            className="projeto-item-nome"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Nova despesa…"
            onKeyDown={(e) => e.key === 'Enter' && salvarItem()}
          />
          <input
            className="projeto-item-valor"
            type="number"
            min="0"
            step="0.01"
            value={novoValor}
            onChange={(e) => setNovoValor(e.target.value)}
            placeholder="0,00"
            onKeyDown={(e) => e.key === 'Enter' && salvarItem()}
          />
          <button className="projeto-add-btn" onClick={salvarItem} title="Adicionar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Timeline de parcelas */}
      {timelineEntries.length > 0 && (
        <div className="projeto-timeline">
          <div className="projeto-timeline-title">Cronograma de pagamentos</div>
          <div className="projeto-timeline-grid">
            {timelineEntries.map(([mm, valor]) => {
              const [y, m] = mm.split('-').map(Number)
              const isPast = mm < yyyymmStr(TODAY_YEAR, TODAY_MONTH)
              return (
                <div key={mm} className={`projeto-tl-item${isPast ? ' past' : ''}`}>
                  <span className="projeto-tl-mm">{mmLabel(y, m)}</span>
                  <span className="projeto-tl-val">{fmtBRL(valor)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Projeção */}
      {totalProjeto > 0 && (
        <div className="projeto-projecao">
          <div className="projeto-projecao-row">
            <span>Custo total do projeto</span>
            <strong>{fmtBRL(totalProjeto)}</strong>
          </div>
          {totalAvista > 0 && totalAvista < totalProjeto && (
            <div className="projeto-projecao-row">
              <span>Pagamento imediato (à vista)</span>
              <strong>{fmtBRL(totalAvista)}</strong>
            </div>
          )}
          {maiorMes > 0 && (
            <div className="projeto-projecao-row">
              <span>Maior mês de parcelas</span>
              <strong>{fmtBRL(maiorMes)}</strong>
            </div>
          )}
          <div className="projeto-projecao-row">
            <span>Saldo disponível hoje</span>
            <strong style={{ color: 'var(--green)' }}>{fmtBRL(saldoAtual)}</strong>
          </div>
          {!temSaldo && (
            <div className="projeto-projecao-row">
              <span>Falta para o pior mês</span>
              <strong style={{ color: 'var(--red)' }}>{fmtBRL(falta)}</strong>
            </div>
          )}
          <div className="projeto-projecao-divider" />

          {temSaldo ? (
            <div className="projeto-status projeto-status-ok">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              Saldo suficiente para começar o projeto!
            </div>
          ) : mediaMensal && mediaMensal > 0 ? (
            <>
              <div className="projeto-projecao-row">
                <span>Performance média / mês</span>
                <strong style={{ color: mediaMensal >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {mediaMensal >= 0 ? '+' : ''}{fmtBRL(mediaMensal)}
                </strong>
              </div>
              {mesesEstimado !== null && (
                <div className="projeto-projecao-row">
                  <span>Estimativa para juntar</span>
                  <strong>{mesesEstimado} {mesesEstimado === 1 ? 'mês' : 'meses'}{dataEstimada ? ` (${dataEstimada})` : ''}</strong>
                </div>
              )}
              {projeto.prazo && prazoStatus && (
                <div className={`projeto-status projeto-status-${prazoStatus}`}>
                  {prazoStatus === 'ok' && <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Vai dar no prazo!</>}
                  {prazoStatus === 'risco' && <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>Apertado — possível, mas sem folga.</>}
                  {prazoStatus === 'impossivel' && <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>Prazo curto com a performance atual.</>}
                </div>
              )}
            </>
          ) : (
            <p className="projeto-sem-dados">Sem dados suficientes — registre ao menos 1 mês completo.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── View ─────────────────────────────────────────────────────────────────────
export default function ProjetosView() {
  const projetos = useStore((s) => s.projetos)
  const addProjeto = useStore((s) => s.addProjeto)
  const saldoAtual = useSaldoAtual()
  const mediaMensal = useMediaMensal(3)

  const lista = projetos ?? []
  const ativos = lista.filter((p) => !p.concluido)
  const concluidos = lista.filter((p) => p.concluido)

  return (
    <div>
      <div className="view-header">
        <h1>Projetos</h1>
        <button className="btn-primary" onClick={() => addProjeto('Novo Projeto')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Novo projeto
        </button>
      </div>

      {mediaMensal !== null && (
        <div className="projeto-contexto">
          <span>Saldo hoje: <strong style={{ color: 'var(--green)' }}>{fmtBRL(saldoAtual)}</strong></span>
          <span className="projeto-contexto-sep">·</span>
          <span>Performance média (últimos 3 meses): <strong style={{ color: mediaMensal >= 0 ? 'var(--green)' : 'var(--red)' }}>{mediaMensal >= 0 ? '+' : ''}{fmtBRL(mediaMensal)}/mês</strong></span>
        </div>
      )}

      {ativos.length === 0 && (
        <div className="projeto-placeholder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25 }}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <p>Nenhum projeto ainda.<br />Clique em <strong>Novo projeto</strong> para começar.</p>
        </div>
      )}

      <div className="projetos-lista">
        {ativos.map((p) => (
          <ProjetoCard key={p.id} projeto={p} saldoAtual={saldoAtual} mediaMensal={mediaMensal} />
        ))}
      </div>

      {concluidos.length > 0 && (
        <details style={{ marginTop: 32 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--ink-muted)', fontSize: 13, marginBottom: 12 }}>
            {concluidos.length} projeto{concluidos.length > 1 ? 's' : ''} concluído{concluidos.length > 1 ? 's' : ''}
          </summary>
          <div className="projetos-lista" style={{ opacity: 0.6 }}>
            {concluidos.map((p) => (
              <ProjetoCard key={p.id} projeto={p} saldoAtual={saldoAtual} mediaMensal={mediaMensal} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
