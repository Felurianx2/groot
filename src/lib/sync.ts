import { supabase } from './supabase'
import type { AppData } from '../types'

export async function loadFromSupabase(): Promise<AppData | null> {
  // Usa limit(1) + maybeSingle para tolerar linhas duplicadas na tabela
  const { data, error } = await supabase
    .from('budgets')
    .select('data')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
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
