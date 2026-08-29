/**
 * Store não persistido para dados do parceiro(a).
 * Carregado pelo CasalView e acessível em qualquer view.
 */
import { create } from 'zustand'
import type { AppData } from './types'

interface PartnerStore {
  partnerBudget: AppData | null
  partnerEmail: string | null
  partnerId: string | null
  setPartner(budget: AppData | null, email?: string | null, id?: string | null): void
  clearPartner(): void
}

export const usePartnerStore = create<PartnerStore>()((set) => ({
  partnerBudget: null,
  partnerEmail: null,
  partnerId: null,
  setPartner: (partnerBudget, partnerEmail = null, partnerId = null) =>
    set({ partnerBudget, partnerEmail, partnerId }),
  clearPartner: () => set({ partnerBudget: null, partnerEmail: null, partnerId: null }),
}))
