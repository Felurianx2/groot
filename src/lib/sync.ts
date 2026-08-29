import { supabase } from './supabase'
import type { AppData } from '../types'

export async function loadFromSupabase(): Promise<AppData | null> {
  // Garante que há sessão ativa antes de consultar
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Busca explicitamente pelo user_id do usuário logado
  // Pega a primeira linha (resolve duplicatas com PGRST116)
  const { data, error } = await supabase
    .from('budgets')
    .select('data')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[sync] loadFromSupabase error:', error)
    return null
  }
  if (!data) return null
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
