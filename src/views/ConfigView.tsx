import { useState, useEffect } from 'react'
import { useStore } from '../store'
import { fmtBRL, MONTH_NAMES } from '../calculations'
import { generateShareToken, revokeShareToken, loadShareToken } from '../lib/share'

// ── Exportação ────────────────────────────────────────────────────────────────
function exportCSV(store: ReturnType<typeof useStore.getState>) {
  const { dias, fixos, projetos, economia, saldoInicial } = store
  const rows: string[][] = []

  // Cabeçalho
  rows.push(['Tipo', 'Data', 'Descrição', 'Valor (R$)'])

  // Lançamentos diários
  const datesSorted = Object.keys(dias).sort()
  for (const date of datesSorted) {
    const entry = dias[date]
    if (entry.entrada) rows.push(['Entrada', date, entry.entradaNota ?? '', String(entry.entrada)])
    for (const it of entry.diarioItens ?? []) rows.push(['Diário', date, it.nota ?? '', String(it.valor)])
    for (const it of entry.saidaItens ?? []) rows.push(['Saída', date, it.nota ?? '', String(it.valor)])
    if (entry.saida && !(entry.saidaItens?.length)) rows.push(['Saída', date, entry.saidaNota ?? '', String(entry.saida)])
  }

  // Fixos
  for (const f of fixos) {
    rows.push(['Fixo', `${f.inicio} → ${f.fim ?? 'indefinido'}`, f.descricao, String(f.valor)])
  }

  // Projetos
  for (const p of projetos ?? []) {
    for (const it of p.itens ?? []) {
      rows.push(['Projeto', p.nome, it.nome, String(it.valor)])
    }
  }

  // Economia
  for (const [mm, val] of Object.entries(economia)) {
    rows.push(['Economia', mm, 'Poupança do mês', String(val)])
  }

  rows.push(['Config', '', 'Saldo inicial', String(saldoInicial)])

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `groot-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportPDF(store: ReturnType<typeof useStore.getState>) {
  const { dias, fixos, projetos, economia, saldoInicial, reservaMinima } = store
  const now = new Date()
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Lançamentos do mês atual
  const entriesMes = Object.entries(dias)
    .filter(([d]) => d.startsWith(mesAtual))
    .sort(([a], [b]) => a.localeCompare(b))

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const mesLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`

  let totalEntradas = 0, totalSaidas = 0

  const linhas = entriesMes.map(([date, e]) => {
    const dia = date.slice(8)
    const items: string[] = []
    if (e.entrada) { totalEntradas += e.entrada; items.push(`<tr><td>${dia}</td><td style="color:#22c55e">Entrada</td><td>${e.entradaNota ?? ''}</td><td style="text-align:right">${fmt(e.entrada)}</td></tr>`) }
    for (const it of e.diarioItens ?? []) { totalSaidas += it.valor; items.push(`<tr><td>${dia}</td><td style="color:#f87171">Diário</td><td>${it.nota ?? ''}</td><td style="text-align:right">-${fmt(it.valor)}</td></tr>`) }
    for (const it of e.saidaItens ?? []) { totalSaidas += it.valor; items.push(`<tr><td>${dia}</td><td style="color:#f87171">Saída</td><td>${it.nota ?? ''}</td><td style="text-align:right">-${fmt(it.valor)}</td></tr>`) }
    if (e.saida && !(e.saidaItens?.length)) { totalSaidas += e.saida; items.push(`<tr><td>${dia}</td><td style="color:#f87171">Saída</td><td>${e.saidaNota ?? ''}</td><td style="text-align:right">-${fmt(e.saida)}</td></tr>`) }
    return items.join('')
  }).join('')

  const fixosAtivos = fixos.filter(f => f.inicio <= mesAtual && (f.fim === null || f.fim >= mesAtual))
  // eslint-disable-next-line @typescript-eslint/no-unused-vars

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Groot — ${mesLabel}</title>
<style>
  body{font-family:system-ui,sans-serif;color:#111;padding:32px;max-width:800px;margin:auto}
  h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{text-align:left;padding:6px 8px;background:#f4f4f4;font-weight:600}
  td{padding:5px 8px;border-bottom:1px solid #eee}
  .summary{display:flex;gap:24px;margin:16px 0;flex-wrap:wrap}
  .card{background:#f8f8f8;border-radius:8px;padding:12px 18px;min-width:140px}
  .card-label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#888}
  .card-val{font-size:17px;font-weight:700;margin-top:2px}
  .green{color:#16a34a}.red{color:#dc2626}
  @media print{body{padding:0}}
</style></head><body>
<h1>Groot — ${mesLabel}</h1>
<p style="font-size:12px;color:#888;margin:0">Gerado em ${now.toLocaleString('pt-BR')}</p>
<div class="summary">
  <div class="card"><div class="card-label">Saldo Inicial</div><div class="card-val">${fmt(saldoInicial)}</div></div>
  <div class="card"><div class="card-label">Entradas</div><div class="card-val green">${fmt(totalEntradas)}</div></div>
  <div class="card"><div class="card-label">Saídas</div><div class="card-val red">${fmt(totalSaidas)}</div></div>
  <div class="card"><div class="card-label">Performance</div><div class="card-val ${totalEntradas - totalSaidas >= 0 ? 'green' : 'red'}">${fmt(totalEntradas - totalSaidas)}</div></div>
  <div class="card"><div class="card-label">Reserva Mínima</div><div class="card-val">${fmt(reservaMinima)}</div></div>
</div>
<h2>Lançamentos — ${mesLabel}</h2>
${linhas ? `<table><thead><tr><th>Dia</th><th>Tipo</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>${linhas}</tbody></table>` : '<p style="color:#888;font-size:13px">Sem lançamentos neste mês.</p>'}
${fixosAtivos.length ? `<h2>Gastos Fixos Ativos</h2><table><thead><tr><th>Nome</th><th>Valor</th><th>Período</th></tr></thead><tbody>${fixosAtivos.map(f => `<tr><td>${f.descricao}</td><td>${fmt(f.valor)}</td><td>${f.inicio} → ${f.fim ?? '∞'}</td></tr>`).join('')}</tbody></table>` : ''}
${(projetos ?? []).length ? `<h2>Projetos</h2><table><thead><tr><th>Projeto</th><th>Item</th><th>Valor</th></tr></thead><tbody>${(projetos ?? []).flatMap(p => (p.itens ?? []).map(it => `<tr><td>${p.nome}</td><td>${it.nome}</td><td>${fmt(it.valor)}</td></tr>`)).join('')}</tbody></table>` : ''}
${Object.keys(economia).length ? `<h2>Economia Mensal</h2><table><thead><tr><th>Mês</th><th>Valor poupado</th></tr></thead><tbody>${Object.entries(economia).sort().map(([mm, v]) => `<tr><td>${mm}</td><td>${fmt(v)}</td></tr>`).join('')}</tbody></table>` : ''}
</body></html>`

  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.onload = () => w.print()
}

const SHARE_BASE = window.location.origin + '/share/'
const API_BASE   = window.location.origin + '/api/share/'

export default function ConfigView() {
  const { saldoInicial, reservaMinima, horizonteMeses, updateConfig } = useStore()

  const [form, setForm] = useState({
    saldoInicial: String(saldoInicial),
    reservaMinima: String(reservaMinima),
    horizonteMeses: String(horizonteMeses),
  })
  const [saved, setSaved] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [copied, setCopied] = useState<'visual' | 'api' | null>(null)

  useEffect(() => {
    loadShareToken().then(setShareToken)
  }, [])

  async function handleGenerate() {
    setShareLoading(true)
    const token = await generateShareToken()
    setShareToken(token)
    setShareLoading(false)
  }

  async function handleRevoke() {
    if (!confirm('Revogar o link? Qualquer um com o link anterior perderá acesso.')) return
    setShareLoading(true)
    await revokeShareToken()
    setShareToken(null)
    setShareLoading(false)
  }

  function handleCopy() {
    if (!shareToken) return
    navigator.clipboard.writeText(SHARE_BASE + shareToken)
    setCopied('visual')
    setTimeout(() => setCopied(null), 2000)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    updateConfig({
      saldoInicial: parseFloat(form.saldoInicial) || 0,
      reservaMinima: parseFloat(form.reservaMinima) || 0,
      horizonteMeses: parseInt(form.horizonteMeses) || 12,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="view-header">
        <h1 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.03em' }}>Configurações</h1>
      </div>

      <form onSubmit={handleSave}>
        <div className="config-section">
          <h2>Saldo Inicial</h2>
          <p className="config-desc">
            O valor com que você começa a usar o app. É o ponto de partida do saldo corrido.
            Valor atual: <strong>{fmtBRL(saldoInicial)}</strong>
          </p>
          <div className="form-row" style={{ maxWidth: 320 }}>
            <div className="field">
              <label htmlFor="saldoInicial">Valor (R$)</label>
              <input
                id="saldoInicial"
                type="number"
                step="0.01"
                className="input"
                value={form.saldoInicial}
                onChange={(e) => setForm({ ...form, saldoInicial: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="config-section">
          <h2>Reserva Mínima</h2>
          <p className="config-desc">
            O colchão de segurança. Saldo abaixo desse valor = amarelo (atenção). Negativo = vermelho.
            Valor atual: <strong>{fmtBRL(reservaMinima)}</strong>
          </p>
          <div className="form-row" style={{ maxWidth: 320 }}>
            <div className="field">
              <label htmlFor="reservaMinima">Valor (R$)</label>
              <input
                id="reservaMinima"
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.reservaMinima}
                onChange={(e) => setForm({ ...form, reservaMinima: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="config-section">
          <h2>Horizonte de Projeção</h2>
          <p className="config-desc">
            Quantos meses à frente os fixos são projetados no saldo futuro. Atual: <strong>{horizonteMeses} meses</strong>
          </p>
          <div className="form-row" style={{ maxWidth: 320 }}>
            <div className="field">
              <label htmlFor="horizonte">Meses</label>
              <input
                id="horizonte"
                type="number"
                min="1"
                max="36"
                className="input"
                value={form.horizonteMeses}
                onChange={(e) => setForm({ ...form, horizonteMeses: e.target.value })}
              />
            </div>
          </div>
        </div>

        <button type="submit" className="btn btn-primary">
          {saved ? '✓ Salvo' : 'Salvar configurações'}
        </button>
      </form>

      <div className="config-section" style={{ marginTop: 24 }}>
        <h2>Cores de status</h2>
        <p className="config-desc">Como o saldo é interpretado visualmente</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {[
            { color: 'var(--green)', bg: 'var(--green-bg)', text: 'var(--green-text)', label: '✓ Verde — Saldo OK', desc: `≥ R$ ${reservaMinima.toLocaleString('pt-BR')}` },
            { color: 'var(--yellow)', bg: 'var(--yellow-bg)', text: 'var(--yellow-text)', label: '! Amarelo — Atenção', desc: `Entre R$ 0 e R$ ${reservaMinima.toLocaleString('pt-BR')}` },
            { color: 'var(--red)', bg: 'var(--red-bg)', text: 'var(--red-text)', label: '✕ Vermelho — Negativo', desc: 'Saldo < R$ 0' },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 8,
                background: s.bg, color: s.text,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 13, minWidth: 180 }}>{s.label}</span>
              <span style={{ fontSize: 12, opacity: 0.8 }}>{s.desc}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Link compartilhável */}
      <div className="config-section" style={{ marginTop: 24 }}>
        <h2>Link de compartilhamento</h2>
        <p className="config-desc">
          Gere um link público (somente leitura) dos seus dados financeiros.
          Útil para compartilhar com o Claude ou com alguém de confiança para análise.
          O link não exige login para visualizar.
        </p>
        {shareToken ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Link visual */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ink-muted)', marginBottom: 5 }}>
                🖥 Link visual (navegador)
              </div>
              <div className="share-link-box">
                <span className="share-link-text">{SHARE_BASE + shareToken}</span>
                <button className="btn btn-secondary share-link-btn" onClick={handleCopy}>
                  {copied === 'visual' ? '✓' : 'Copiar'}
                </button>
              </div>
            </div>
            {/* Link API para Claude */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ink-muted)', marginBottom: 5 }}>
                🤖 Link para Claude / API (JSON)
              </div>
              <div className="share-link-box">
                <span className="share-link-text">{API_BASE + shareToken}</span>
                <button className="btn btn-secondary share-link-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(API_BASE + shareToken)
                    setCopied('api')
                    setTimeout(() => setCopied(null), 2000)
                  }}>
                  {copied === 'api' ? '✓' : 'Copiar'}
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--ink-faint)', margin: '4px 0 0' }}>
                Cole esse link no Claude para análise direta das suas finanças.
              </p>
            </div>
            <div>
              <button className="btn btn-danger" onClick={handleRevoke} disabled={shareLoading}>
                Revogar links
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: 0 }}>
              ⚠ Qualquer pessoa com esses links pode ver seus dados. Revogue quando não precisar mais.
            </p>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={handleGenerate} disabled={shareLoading}>
            {shareLoading ? 'Gerando…' : '🔗 Gerar link de compartilhamento'}
          </button>
        )}
      </div>

      {/* Exportação */}
      <div className="config-section" style={{ marginTop: 24 }}>
        <h2>Exportar dados</h2>
        <p className="config-desc">
          CSV inclui todos os lançamentos, fixos, projetos e economia. PDF gera o relatório do mês atual para imprimir ou salvar.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => exportCSV(useStore.getState())}>
            ⬇ Exportar CSV
          </button>
          <button className="btn btn-secondary" onClick={() => exportPDF(useStore.getState())}>
            🖨 Exportar PDF (mês atual)
          </button>
        </div>
      </div>

      <div className="config-section" style={{ marginTop: 16 }}>
        <h2>Suporte</h2>
        <p className="config-desc">
          Dúvidas ou problemas? Entre em contato:{' '}
          <a href="mailto:grootapp@proton.me" style={{ color: 'var(--primary)', fontWeight: 500 }}>
            grootapp@proton.me
          </a>
        </p>
      </div>
    </div>
  )
}
