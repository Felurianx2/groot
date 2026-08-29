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

  // Usa array (sem maybeSingle) para evitar 406 quando há múltiplas linhas
  const { data: rows, error } = await supabase
    .from('budgets')
    .select('data')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)

  const data = rows?.[0] ?? null
  console.log('[sync] query result — rows:', rows?.length ?? 0, '| error:', error?.message ?? null, error?.code ?? '')
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
