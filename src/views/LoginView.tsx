import { useState } from 'react'
import { supabase } from '../lib/supabase'
import logo from '/groot-ui.png'

type Mode = 'login' | 'signup'

export default function LoginView() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setInfo('Verifique seu e-mail para confirmar a conta.')
    }
    setLoading(false)
  }

  async function handleGoogle() {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setError(error.message)
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo / brand */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <img
            src={logo}
            alt="Groot"
            style={{ height: 96, objectFit: 'contain', display: 'block', margin: '0 auto 12px' }}
          />
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.04em' }}>Groot</h1>
          <p style={{ color: 'var(--ink-muted)', fontSize: 14, marginTop: 4 }}>
            Seu orçamento previsível
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 28,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>
            {mode === 'login' ? 'Entrar na sua conta' : 'Criar conta'}
          </h2>

          {/* Google */}
          <button
            onClick={handleGoogle}
            style={{
              width: '100%', padding: '10px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
              color: 'var(--ink)', fontFamily: 'var(--font)',
              transition: 'background 150ms',
              marginBottom: 16,
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'var(--bg)')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar com Google
          </button>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
            color: 'var(--ink-faint)', fontSize: 12,
          }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            ou
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Email + senha */}
          <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="field">
              <label htmlFor="password">Senha</label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {error && (
              <div style={{
                padding: '10px 12px', borderRadius: 8,
                background: 'var(--red-bg)', color: 'var(--red-text)',
                fontSize: 13,
              }}>
                {error}
              </div>
            )}

            {info && (
              <div style={{
                padding: '10px 12px', borderRadius: 8,
                background: 'var(--green-bg)', color: 'var(--green-text)',
                fontSize: 13,
              }}>
                {info}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
            >
              {loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--ink-muted)' }}>
            {mode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setInfo('') }}
              style={{ color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}
            >
              {mode === 'login' ? 'Criar conta' : 'Entrar'}
            </button>
          </p>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'var(--ink-faint)' }}>
          Suporte:{' '}
          <a href="mailto:grootapp@proton.me" style={{ color: 'var(--ink-muted)' }}>
            grootapp@proton.me
          </a>
        </p>
      </div>
    </div>
  )
}
