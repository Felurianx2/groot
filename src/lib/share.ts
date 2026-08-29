import { supabase } from './supabase'
import type { AppData } from '../types'

/** Gera/salva share token para o usuário autenticado */
export async function generateShareToken(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const token = crypto.randomUUID()
  const { error } = await supabase
    .from('budgets')
    .update({ share_token: token })
    .eq('user_id', user.id)
  if (error) return null
  return token
}

/** Remove share token (revoga acesso) */
export async function revokeShareToken(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('budgets')
    .update({ share_token: null })
    .eq('user_id', user.id)
  return !error
}

/** Carrega o share token atual do usuário */
export async function loadShareToken(): Promise<string | null> {
  const { data } = await supabase
    .from('budgets')
    .select('share_token')
    .single()
  return data?.share_token ?? null
}

/** Busca dados de um budget público pelo token (sem autenticação) */
export async function fetchSharedBudget(token: string): Promise<AppData | null> {
  const { data, error } = await supabase.rpc('get_shared_budget', { p_token: token })
  if (error || !data) return null
  return data as AppData
}
