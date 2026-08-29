import { supabase } from './supabase'
import type { AppData } from '../types'

export async function loadFromSupabase(): Promise<AppData | null> {
  // getSession() lê do localStorage sem requisição de rede (mais confiável)
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null
  const userId = session.user.id

  const { data, error } = await supabase
    .from('budgets')
    .select('data')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[sync] loadFromSupabase error:', error.message, error.code)
    return null
  }
  if (!data) {
    console.warn('[sync] nenhum budget encontrado para user:', userId)
    return null
  }
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
