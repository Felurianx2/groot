import { useState } from 'react'
import { useStore } from '../store'
import { fmtBRL } from '../calculations'

export default function ConfigView() {
  const { saldoInicial, reservaMinima, horizonteMeses, updateConfig } = useStore()

  const [form, setForm] = useState({
    saldoInicial: String(saldoInicial),
    reservaMinima: String(reservaMinima),
    horizonteMeses: String(horizonteMeses),
  })
  const [saved, setSaved] = useState(false)

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
