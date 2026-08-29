import { supabase } from './supabase'
import type { AppData } from '../types'

export async function loadFromSupabase(): Promise<AppData | null> {
  // getSession() lê do localStorage sem requisição de rede (mais confiável)
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  console.log('[sync] session:', session?.user?.id ?? null, '| sessionError:', sessionError?.message ?? null)
  if (!session?.user) {
    console.warn('[sync] sem sessão — abortando load')
    return null
  }
  const userId = session.user.id

  const { data, error, count } = await supabase
    .from('budgets')
    .select('data', { count: 'exact' })
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  console.log('[sync] query result — data:', data ? '(presente)' : null, '| count:', count, '| error:', error?.message ?? null, error?.code ?? '')
  if (error) {
    console.error('[sync] loadFromSupabase error:', error.message, error.code)
    return null
  }
  if (!data) {
    console.warn('[sync] nenhum budget encontrado para user:', userId)
    return null
  }
  console.log('[sync] budget carregado com sucesso')
  return data.data as AppData
}

export async function saveToSupabase(appData: AppData): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('budgets')
    .upsert({ user_id: user.id, data: appData }, { onConflict: 'user_id' })
}

// Debounced save — evita salvar a cada keystroke
let saveTimer: ReturnType<typeof setTimeout> | null = null

export function debouncedSave(appData: AppData, delayMs = 1500) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveToSupabase(appData), delayMs)
}
