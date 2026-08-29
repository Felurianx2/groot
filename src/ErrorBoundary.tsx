import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null; info: ErrorInfo | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info })
    console.error('[ErrorBoundary] Uncaught:', error.message)
    console.error('[ErrorBoundary] Component stack:', info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 24, fontFamily: 'monospace', fontSize: 13,
          background: '#1a0000', color: '#ff6b6b', minHeight: '100dvh',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
            ⚠️ Groot — Erro na renderização
          </div>
          <div style={{ marginBottom: 8, color: '#ffaaaa' }}>
            {this.state.error.message}
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 16 }}>
            {this.state.info?.componentStack}
          </div>
          <button
            onClick={() => {
              // Reset activeView para 'month' e recarrega
              try {
                const raw = localStorage.getItem('groot-v1')
                if (raw) {
                  const s = JSON.parse(raw)
                  if (s.state) s.state.activeView = 'month'
                  localStorage.setItem('groot-v1', JSON.stringify(s))
                }
              } catch {}
              location.reload()
            }}
            style={{
              padding: '8px 16px', background: '#3b1fa8', color: '#fff',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13,
            }}
          >
            Resetar e recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
