import { useEffect, useRef } from 'react'
import { useAuth } from './lib/auth'
import { loadFromSupabase, debouncedSave } from './lib/sync'
import { useStore } from './store'
import Nav from './components/Nav'
import MonthView from './views/MonthView'
import YearView from './views/YearView'
import FixosView from './views/FixosView'
import EconomiaView from './views/EconomiaView'
import ProjetosView from './views/ProjetosView'
import ConfigView from './views/ConfigView'
import CasalView from './views/CasalView'
import LoginView from './views/LoginView'
import SharedView from './views/SharedView'

// Detecta rota /share/{token}
const shareMatch = window.location.pathname.match(/^\/share\/([0-9a-f-]{36})$/)
if (shareMatch) {
  // Renderizado separado fora do App normal
}

function AppShell() {
  const activeView = useStore((s) => s.activeView)
  const store = useStore()
  const { user, signOut } = useAuth()
  const synced = useRef(false)
  // Bloqueia o auto-save até o load remoto terminar
  const loadedRef = useRef(false)

  // Ao fazer login, carrega dados do Supabase
  // Reset synced quando usuário faz logout, para recarregar no próximo login
  useEffect(() => {
    if (!user) { synced.current = false; loadedRef.current = false; return }
    if (synced.current) return
    synced.current = true

    loadFromSupabase().then((remote) => {
      if (remote) {
        useStore.setState({
          saldoInicial: remote.saldoInicial ?? store.saldoInicial,
          reservaMinima: remote.reservaMinima ?? store.reservaMinima,
          horizonteMeses: remote.horizonteMeses ?? store.horizonteMeses,
          dias: remote.dias ?? store.dias,
          fixos: remote.fixos ?? store.fixos,
          economia: remote.economia ?? store.economia,
          notasAno: remote.notasAno ?? store.notasAno,
          projetos: remote.projetos ?? store.projetos ?? [],
        })
      }
      // Só libera o auto-save APÓS o load terminar (evita sobrescrever dados reais com defaults)
      loadedRef.current = true
    })
  }, [user])

  // Sync automático a cada mudança (debounced 1.5s)
  // Só salva após o load remoto ter terminado
  useEffect(() => {
    if (!user) return
    if (!loadedRef.current) return
    const { saldoInicial, reservaMinima, horizonteMeses, dias, fixos, economia, notasAno, projetos } = store
    debouncedSave({ saldoInicial, reservaMinima, horizonteMeses, dias, fixos, economia, notasAno, projetos })
  }, [
    store.saldoInicial, store.reservaMinima, store.horizonteMeses,
    store.dias, store.fixos, store.economia, store.notasAno, store.projetos,
    user,
  ])

  return (
    <>
      <Nav onSignOut={signOut} user={user} />
      <main className="content">
        {activeView === 'month' && <MonthView />}
        {activeView === 'year' && <YearView />}
        {activeView === 'fixos' && <FixosView />}
        {activeView === 'economia' && <EconomiaView />}
        {activeView === 'projetos' && <ProjetosView />}
        {activeView === 'casal' && <CasalView />}
        {activeView === 'config' && <ConfigView />}
      </main>
    </>
  )
}

export default function App() {
  // Hooks SEMPRE antes de qualquer return condicional (React rules)
  const { user, loading } = useAuth()

  // Rota pública /share/:token — sem necessidade de login
  if (shareMatch) {
    return <SharedView token={shareMatch[1]} />
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg)',
      }}>
        <div style={{ color: 'var(--ink-faint)', fontSize: 14 }}>Carregando…</div>
      </div>
    )
  }

  if (!user) return <LoginView />

  return <AppShell />
}
