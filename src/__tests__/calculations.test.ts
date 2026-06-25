import { describe, it, expect } from 'vitest'
import {
  getMonthRows,
  getMonthSummary,
  getStartSaldoForMonth,
  getSaldoStatus,
  daysInMonth,
} from '../calculations'
import type { AppData } from '../types'

const TODAY = '2099-12-31' // far future so nothing is "future" in tests

function makeData(overrides: Partial<AppData> = {}): AppData {
  return {
    saldoInicial: 1000,
    reservaMinima: 1000,
    horizonteMeses: 12,
    dias: {},
    fixos: [],
    economia: {},
    notasAno: {},
    ...overrides,
  }
}

// ── §4.1 — Saldo diário corrido ───────────────────────────────────────────

describe('§4.1 — saldo diário corrido', () => {
  it('reproduz o exemplo validado do PRD (saldo inicial = 1000)', () => {
    const data = makeData({
      saldoInicial: 1000,
      dias: {
        '2026-01-05': { entrada: 3000 },
        '2026-01-07': { diario: 500 },
        '2026-01-10': { saida: 2000 },
      },
    })

    const rows = getMonthRows(2026, 1, 1000, data.dias, data.fixos, TODAY)

    expect(rows[4].saldo).toBe(4000) // dia 5
    expect(rows[6].saldo).toBe(3500) // dia 7
    expect(rows[9].saldo).toBe(1500) // dia 10
  })

  it('dias sem lançamento mantêm o saldo anterior', () => {
    const data = makeData({ saldoInicial: 500 })
    const rows = getMonthRows(2026, 3, 500, data.dias, data.fixos, TODAY)

    expect(rows[0].saldo).toBe(500) // dia 1 vazio
    expect(rows[1].saldo).toBe(500) // dia 2 vazio
    expect(rows[30].saldo).toBe(500) // dia 31 vazio (março tem 31)
  })

  it('saldo pode ficar negativo (sem bloqueio)', () => {
    const data = makeData({
      dias: { '2026-02-01': { saida: 2000 } },
    })
    const rows = getMonthRows(2026, 2, 500, data.dias, data.fixos, TODAY)
    expect(rows[0].saldo).toBe(-1500)
  })

  it('carryover: saldo final do mês anterior é o saldo inicial do próximo', () => {
    const data = makeData({
      saldoInicial: 1000,
      dias: {
        '2026-01-05': { entrada: 3000 },
        '2026-01-07': { diario: 500 },
        '2026-01-10': { saida: 2000 },
      },
    })

    const cache = new Map<string, number>()
    const jan1Start = getStartSaldoForMonth(2026, 1, data, TODAY, cache)
    const janRows = getMonthRows(2026, 1, jan1Start, data.dias, data.fixos, TODAY)
    const janFinal = janRows[janRows.length - 1].saldo // 1500

    const feb1Start = getStartSaldoForMonth(2026, 2, data, TODAY, cache)
    expect(feb1Start).toBe(janFinal)
  })

  it('carryover atravessa a virada de ano', () => {
    const data = makeData({
      saldoInicial: 2000,
      dias: { '2026-12-31': { entrada: 500 } },
    })

    const cache = new Map<string, number>()
    const dec1Start = getStartSaldoForMonth(2026, 12, data, TODAY, cache)
    const decRows = getMonthRows(2026, 12, dec1Start, data.dias, data.fixos, TODAY)
    const decFinal = decRows[decRows.length - 1].saldo // 2000 + 500 = 2500

    const jan27Start = getStartSaldoForMonth(2027, 1, data, TODAY, cache)
    expect(jan27Start).toBe(decFinal)
  })
})

// ── §4.2 — Totais e indicadores mensais ──────────────────────────────────

describe('§4.2 — totais e indicadores mensais', () => {
  it('calcula totalEntradas, totalSaidas, totalDiario, saidaTotal, performance', () => {
    const data = makeData({
      saldoInicial: 1000,
      dias: {
        '2026-01-05': { entrada: 3000 },
        '2026-01-07': { diario: 500 },
        '2026-01-10': { saida: 2000 },
      },
    })

    const rows = getMonthRows(2026, 1, 1000, data.dias, data.fixos, TODAY)
    const summary = getMonthSummary(rows, 1000)

    expect(summary.totalEntradas).toBe(3000)
    expect(summary.totalSaidas).toBe(2000)
    expect(summary.totalDiario).toBe(500)
    expect(summary.saidaTotal).toBe(2500)
    expect(summary.performance).toBe(500) // 3000 - 2500
    expect(summary.saldoFinal).toBe(1500)
  })

  it('performance negativa quando saídas > entradas', () => {
    const data = makeData({
      dias: {
        '2026-03-01': { entrada: 1000 },
        '2026-03-15': { saida: 1500 },
        '2026-03-20': { diario: 200 },
      },
    })
    const rows = getMonthRows(2026, 3, 0, data.dias, data.fixos, TODAY)
    const summary = getMonthSummary(rows, 0)

    expect(summary.performance).toBe(-700) // 1000 - 1700
  })
})

// ── Cores de status ───────────────────────────────────────────────────────

describe('getSaldoStatus', () => {
  it('verde quando saldo >= reservaMinima', () => {
    expect(getSaldoStatus(1000, 1000)).toBe('green')
    expect(getSaldoStatus(1500, 1000)).toBe('green')
  })

  it('amarelo quando 0 <= saldo < reservaMinima', () => {
    expect(getSaldoStatus(999, 1000)).toBe('yellow')
    expect(getSaldoStatus(0, 1000)).toBe('yellow')
  })

  it('vermelho quando saldo < 0', () => {
    expect(getSaldoStatus(-1, 1000)).toBe('red')
    expect(getSaldoStatus(-9999, 1000)).toBe('red')
  })
})

// ── Fixos e projeção ──────────────────────────────────────────────────────

describe('fixos — projeção', () => {
  it('aplica fixo em mês futuro', () => {
    const data = makeData({
      fixos: [
        { id: '1', dia: 5, tipo: 'entrada', valor: 4000, descricao: 'Salário', inicio: '2026-01', fim: null },
        { id: '2', dia: 10, tipo: 'saida', valor: 1500, descricao: 'Aluguel', inicio: '2026-01', fim: null },
      ],
    })

    // Usando uma data "passada" para que os dias de julho/2099 sejam "futuros"
    const future = '2026-06-01'
    const rows = getMonthRows(2026, 7, 1000, data.dias, data.fixos, future)

    expect(rows[4].entrada).toBe(4000)
    expect(rows[4].entradaIsProjected).toBe(true)
    expect(rows[9].saida).toBe(1500)
    expect(rows[9].saidaIsProjected).toBe(true)
  })

  it('fixo com dia=31 em fevereiro cai no último dia do mês', () => {
    const data = makeData({
      fixos: [{ id: '1', dia: 31, tipo: 'saida', valor: 800, descricao: 'Teste', inicio: '2026-01', fim: null }],
    })

    const future = '2026-01-01'
    const rows = getMonthRows(2026, 2, 1000, data.dias, data.fixos, future)

    expect(daysInMonth(2026, 2)).toBe(28) // 2026 não é bissexto
    expect(rows[27].saida).toBe(800) // dia 28, índice 27
    expect(rows[27].saidaIsProjected).toBe(true)
  })

  it('valor real digitado sobrescreve projeção', () => {
    const data = makeData({
      fixos: [{ id: '1', dia: 5, tipo: 'entrada', valor: 4000, descricao: 'Salário', inicio: '2026-01', fim: null }],
      dias: { '2026-07-05': { entrada: 3800 } }, // valor real diferente
    })

    const future = '2026-06-01'
    const rows = getMonthRows(2026, 7, 0, data.dias, data.fixos, future)

    expect(rows[4].entrada).toBe(3800)
    expect(rows[4].entradaIsProjected).toBe(false) // não é projeção
  })

  it('fixo não é aplicado antes do mês de inicio', () => {
    const data = makeData({
      fixos: [{ id: '1', dia: 1, tipo: 'entrada', valor: 1000, descricao: 'X', inicio: '2026-06', fim: null }],
    })

    const future = '2025-12-01'
    const rows = getMonthRows(2026, 5, 0, data.dias, data.fixos, future) // maio/2026 < inicio jun
    expect(rows[0].entrada).toBe(0)
    expect(rows[0].entradaIsProjected).toBe(false)
  })

  it('fixo não é aplicado após o mês de fim', () => {
    const data = makeData({
      fixos: [{ id: '1', dia: 1, tipo: 'entrada', valor: 1000, descricao: 'X', inicio: '2026-01', fim: '2026-03' }],
    })

    const future = '2025-12-01'
    const rows = getMonthRows(2026, 4, 0, data.dias, data.fixos, future) // abril > fim
    expect(rows[0].entrada).toBe(0)
  })
})
