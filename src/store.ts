import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppData, DayEntry, DiarioItem, Fixo, Projeto, ProjetoItem, ActiveView } from './types'

interface AppStore extends AppData {
  currentYear: number
  currentMonth: number
  activeView: ActiveView

  setActiveView(v: ActiveView): void
  setCurrentMonth(year: number, month: number): void
  updateDay(date: string, field: keyof DayEntry, value: number | undefined): void
  updateDayNota(date: string, field: 'entrada' | 'saida', nota: string): void
  addDiarioItem(date: string, item: Omit<DiarioItem, 'id'>): void
  updateDiarioItem(date: string, id: string, partial: Partial<Omit<DiarioItem, 'id'>>): void
  removeDiarioItem(date: string, id: string): void
  addSaidaItem(date: string, item: Omit<DiarioItem, 'id'>): void
  updateSaidaItem(date: string, id: string, partial: Partial<Omit<DiarioItem, 'id'>>): void
  removeSaidaItem(date: string, id: string): void
  addFixo(fixo: Omit<Fixo, 'id'>): void
  updateFixo(id: string, partial: Partial<Omit<Fixo, 'id'>>): void
  removeFixo(id: string): void
  setEconomia(yyyymm: string, value: number): void
  setNotaAno(yyyy: string, nota: string): void
  updateConfig(config: Partial<Pick<AppData, 'saldoInicial' | 'reservaMinima' | 'horizonteMeses'>>): void
  addProjeto(nome: string): void
  updateProjeto(id: string, partial: Partial<Omit<Projeto, 'id' | 'itens'>>): void
  removeProjeto(id: string): void
  addProjetoItem(projetoId: string, item: Omit<ProjetoItem, 'id'>): void
  updateProjetoItem(projetoId: string, itemId: string, partial: Partial<Omit<ProjetoItem, 'id'>>): void
  removeProjetoItem(projetoId: string, itemId: string): void
}

const now = new Date()

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      saldoInicial: 1000,
      reservaMinima: 1000,
      horizonteMeses: 12,
      dias: {},
      fixos: [],
      economia: {},
      notasAno: {},
      projetos: [],
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      activeView: 'month',

      setActiveView: (activeView) => set({ activeView }),

      setCurrentMonth: (currentYear, currentMonth) => set({ currentYear, currentMonth }),

      updateDay: (date, field, value) =>
        set((state) => {
          const existing = state.dias[date] ?? {}
          if (value === undefined || (value === 0 && existing[field] === undefined)) {
            const { [field]: _, ...rest } = existing as Record<string, number>
            const newDias = { ...state.dias }
            if (Object.keys(rest).length === 0) delete newDias[date]
            else newDias[date] = rest
            return { dias: newDias }
          }
          return {
            dias: { ...state.dias, [date]: { ...existing, [field]: value } },
          }
        }),

      updateDayNota: (date, field, nota) =>
        set((state) => {
          const existing = state.dias[date] ?? {}
          const key = field === 'entrada' ? 'entradaNota' : 'saidaNota'
          return { dias: { ...state.dias, [date]: { ...existing, [key]: nota } } }
        }),

      addDiarioItem: (date, item) =>
        set((state) => {
          const existing = state.dias[date] ?? {}
          const prev = existing.diarioItens ?? []
          return {
            dias: {
              ...state.dias,
              [date]: { ...existing, diarioItens: [...prev, { ...item, id: crypto.randomUUID() }] },
            },
          }
        }),

      updateDiarioItem: (date, id, partial) =>
        set((state) => {
          const existing = state.dias[date] ?? {}
          const prev = existing.diarioItens ?? []
          return {
            dias: {
              ...state.dias,
              [date]: { ...existing, diarioItens: prev.map((i) => (i.id === id ? { ...i, ...partial } : i)) },
            },
          }
        }),

      removeDiarioItem: (date, id) =>
        set((state) => {
          const existing = state.dias[date] ?? {}
          const next = (existing.diarioItens ?? []).filter((i) => i.id !== id)
          return { dias: { ...state.dias, [date]: { ...existing, diarioItens: next } } }
        }),

      addSaidaItem: (date, item) =>
        set((state) => {
          const existing = state.dias[date] ?? {}
          const prev = existing.saidaItens ?? []
          // migra saida legacy para saidaItens se necessário
          const migrated = existing.saida !== undefined && prev.length === 0
            ? [{ id: crypto.randomUUID(), valor: existing.saida, nota: existing.saidaNota ?? '' }]
            : prev
          const { saida: _s, saidaNota: _sn, ...rest } = existing as Record<string, unknown>
          return {
            dias: {
              ...state.dias,
              [date]: { ...rest, saidaItens: [...migrated, { ...item, id: crypto.randomUUID() }] },
            },
          }
        }),

      updateSaidaItem: (date, id, partial) =>
        set((state) => {
          const existing = state.dias[date] ?? {}
          const prev = existing.saidaItens ?? []
          return {
            dias: {
              ...state.dias,
              [date]: { ...existing, saidaItens: prev.map((i) => (i.id === id ? { ...i, ...partial } : i)) },
            },
          }
        }),

      removeSaidaItem: (date, id) =>
        set((state) => {
          const existing = state.dias[date] ?? {}
          const next = (existing.saidaItens ?? []).filter((i) => i.id !== id)
          return { dias: { ...state.dias, [date]: { ...existing, saidaItens: next } } }
        }),

      addFixo: (fixo) =>
        set((state) => ({
          fixos: [...state.fixos, { ...fixo, id: crypto.randomUUID() }],
        })),

      updateFixo: (id, partial) =>
        set((state) => ({
          fixos: state.fixos.map((f) => (f.id === id ? { ...f, ...partial } : f)),
        })),

      removeFixo: (id) =>
        set((state) => ({ fixos: state.fixos.filter((f) => f.id !== id) })),

      setEconomia: (yyyymm, value) =>
        set((state) => ({ economia: { ...state.economia, [yyyymm]: value } })),

      setNotaAno: (yyyy, nota) =>
        set((state) => ({ notasAno: { ...state.notasAno, [yyyy]: nota } })),

      updateConfig: (config) => set(config),

      addProjeto: (nome) =>
        set((state) => ({
          projetos: [...(state.projetos ?? []), { id: crypto.randomUUID(), nome, prazo: null, itens: [], concluido: false }],
        })),

      updateProjeto: (id, partial) =>
        set((state) => ({
          projetos: (state.projetos ?? []).map((p) => (p.id === id ? { ...p, ...partial } : p)),
        })),

      removeProjeto: (id) =>
        set((state) => ({ projetos: (state.projetos ?? []).filter((p) => p.id !== id) })),

      addProjetoItem: (projetoId, item) =>
        set((state) => ({
          projetos: (state.projetos ?? []).map((p) =>
            p.id === projetoId
              ? { ...p, itens: [...p.itens, { ...item, id: crypto.randomUUID() }] }
              : p,
          ),
        })),

      updateProjetoItem: (projetoId, itemId, partial) =>
        set((state) => ({
          projetos: (state.projetos ?? []).map((p) =>
            p.id === projetoId
              ? { ...p, itens: p.itens.map((i) => (i.id === itemId ? { ...i, ...partial } : i)) }
              : p,
          ),
        })),

      removeProjetoItem: (projetoId, itemId) =>
        set((state) => ({
          projetos: (state.projetos ?? []).map((p) =>
            p.id === projetoId ? { ...p, itens: p.itens.filter((i) => i.id !== itemId) } : p,
          ),
        })),
    }),
    { name: 'groot-v1' },
  ),
)
