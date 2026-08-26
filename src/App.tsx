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
import LoginView from './views/LoginView'

function AppShell() {
  const activeView = useStore((s) => s.activeView)
  const store = useStore()
  const { user, signOut } = useAuth()
  const synced = useRef(false)

  // Ao fazer login, carrega dados do Supabase (sobrescreve localStorage se tiver dado mais recente)
  useEffect(() => {
    if (!user || synced.current) return
    synced.current = true

    loadFromSupabase().then((remote) => {
      if (!remote) return
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
    })
  }, [user])

  // Sync automático a cada mudança (debounced 1.5s)
  useEffect(() => {
    if (!user) return
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
        {activeView === 'config' && <ConfigView />}
      </main>
    </>
  )
}

export default function App() {
  const { user, loading } = useAuth()

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
