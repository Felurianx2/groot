import { supabase } from './supabase'
import type { AppData } from '../types'

export interface CasalInvite {
  id: string
  inviter_id: string
  invitee_email: string
  invitee_id: string | null
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
}

export type CasalStatusType = 'none' | 'sent-pending' | 'received-pending' | 'connected'

export interface CasalStatus {
  type: CasalStatusType
  invite?: CasalInvite
  partnerId?: string
  partnerEmail?: string
}

/** Upsert do profile do usuário logado (necessário para RLS dos convites) */
export async function upsertProfile(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return
  await supabase.from('profiles').upsert(
    { user_id: user.id, email: user.email, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
}

/** Status atual do casal */
export async function getCasalStatus(): Promise<CasalStatus> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { type: 'none' }

  // RLS filtra: convites que eu enviei + convites onde invitee_email = meu email
  const { data: invites } = await supabase
    .from('couple_invites')
    .select('*')
    .order('created_at', { ascending: false })

  if (!invites?.length) return { type: 'none' }

  const sent     = invites.find(i => i.inviter_id === user.id && i.status !== 'rejected')
  const received = invites.find(i => i.inviter_id !== user.id && i.status !== 'rejected')

  // Conectados — prioridade
  if (sent?.status === 'accepted') {
    return { type: 'connected', invite: sent, partnerId: sent.invitee_id, partnerEmail: sent.invitee_email }
  }
  if (received?.status === 'accepted') {
    const { data: p } = await supabase.from('profiles').select('email').eq('user_id', received.inviter_id).single()
    return { type: 'connected', invite: received, partnerId: received.inviter_id, partnerEmail: p?.email }
  }
  // Convite recebido pendente
  if (received?.status === 'pending') {
    const { data: p } = await supabase.from('profiles').select('email').eq('user_id', received.inviter_id).single()
    return { type: 'received-pending', invite: received, partnerEmail: p?.email }
  }
  // Convite enviado pendente
  if (sent?.status === 'pending') {
    return { type: 'sent-pending', invite: sent, partnerEmail: sent.invitee_email }
  }

  return { type: 'none' }
}

/** Envia convite para o parceiro(a) */
export async function sendInvite(partnerEmail: string): Promise<{ ok: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autenticado' }

  const { error } = await supabase.from('couple_invites').insert({
    inviter_id: user.id,
    invitee_email: partnerEmail.toLowerCase().trim(),
  })

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Já existe um convite ativo para esse email.' }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/** Aceita convite recebido */
export async function acceptInvite(inviteId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await supabase
    .from('couple_invites')
    .update({ status: 'accepted', invitee_id: user.id })
    .eq('id', inviteId)
  return !error
}

/** Cancela ou rejeita convite */
export async function cancelInvite(inviteId: string): Promise<boolean> {
  const { error } = await supabase
    .from('couple_invites')
    .update({ status: 'rejected' })
    .eq('id', inviteId)
  return !error
}

/** Carrega orçamento do parceiro(a) via RLS */
export async function loadPartnerBudget(partnerId: string): Promise<AppData | null> {
  const { data, error } = await supabase
    .from('budgets')
    .select('data')
    .eq('user_id', partnerId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return data.data as AppData
}
