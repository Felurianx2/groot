import type { AppData, DayEntry, Fixo, Projeto, SaldoStatus } from './types'

export function getDiarioTotal(entry: DayEntry | undefined): number {
  if (!entry) return 0
  if (entry.diarioItens && entry.diarioItens.length > 0)
    return entry.diarioItens.reduce((s, i) => s + i.valor, 0)
  return entry.diario ?? 0
}

export function getSaidaTotal(entry: DayEntry | undefined): number {
  if (!entry) return 0
  if (entry.saidaItens && entry.saidaItens.length > 0)
    return entry.saidaItens.reduce((s, i) => s + i.valor, 0)
  return entry.saida ?? 0
}

export function hasSaidaManual(entry: DayEntry | undefined): boolean {
  if (!entry) return false
  return (entry.saidaItens?.length ?? 0) > 0 || entry.saida !== undefined
}

export interface DaySaldoRow {
  day: number
  date: string
  entrada: number
  saida: number
  diario: number
  saldo: number
  entradaIsProjected: boolean
  saidaIsProjected: boolean
}

export interface MonthSummary {
  totalEntradas: number
  totalSaidas: number
  totalDiario: number
  saidaTotal: number
  performance: number
  saldoFinal: number
  startSaldo: number
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function yyyymmStr(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function prevMonth(year: number, month: number): [number, number] {
  return month === 1 ? [year - 1, 12] : [year, month - 1]
}

function addMonths(y: number, m: number, n: number): [number, number] {
  const total = (m - 1) + n
  return [y + Math.floor(total / 12), (total % 12) + 1]
}

// Custo total de projetos que "caem" num determinado mês (YYYY-MM).
// Lógica idêntica ao projetoChipsByDay do MonthView — itens sem parcelaInicio são ignorados.
export function getProjetosCostForMonth(projetos: Projeto[], mm: string): number {
  const [ty, tm] = mm.split('-').map(Number)
  let total = 0
  for (const projeto of projetos) {
    if (projeto.concluido) continue
    for (const item of (projeto.itens ?? [])) {
      if (!item.parcelaInicio || item.valor <= 0) continue
      const parcelas = item.parcelas ?? 1
      const valorParcela = item.valor / parcelas
      const freq = item.frequencia ?? 'mensal'

      if (freq === 'semanal' && item.parcelaInicio.length === 10) {
        const base = new Date(item.parcelaInicio + 'T12:00:00')
        for (let i = 0; i < parcelas; i++) {
          const d = new Date(base)
          d.setDate(d.getDate() + i * 7)
          if (d.getFullYear() === ty && d.getMonth() + 1 === tm) {
            total += valorParcela
          }
        }
      } else if (item.parcelaInicio.length >= 7) {
        const [iy, im] = item.parcelaInicio.slice(0, 7).split('-').map(Number)
        for (let p = 0; p < parcelas; p++) {
          const [y, m] = addMonths(iy, im, p)
          if (y === ty && m === tm) { total += valorParcela; break }
        }
      }
    }
  }
  return total
}

function effectiveFixoDay(fixoDia: number, year: number, month: number): number {
  return Math.min(fixoDia, daysInMonth(year, month))
}

function getProjectedForDay(
  year: number,
  month: number,
  day: number,
  fixos: Fixo[],
  tipo: 'entrada' | 'saida',
): number {
  const mm = yyyymmStr(year, month)
  return fixos
    .filter((f) => {
      if (f.tipo !== tipo) return false
      if (f.inicio > mm) return false
      if (f.fim !== null && f.fim < mm) return false
      return effectiveFixoDay(f.dia, year, month) === day
    })
    .reduce((sum, f) => sum + f.valor, 0)
}

export function getMonthRows(
  year: number,
  month: number,
  startSaldo: number,
  dias: Record<string, DayEntry>,
  fixos: Fixo[],
  todayStr: string,
): DaySaldoRow[] {
  const rows: DaySaldoRow[] = []
  const n = daysInMonth(year, month)
  let runSaldo = startSaldo

  for (let d = 1; d <= n; d++) {
    const key = dateStr(year, month, d)
    const isFuture = key > todayStr
    const entry = dias[key]

    let entrada = 0
    let entradaIsProjected = false
    if (entry?.entrada !== undefined) {
      entrada = entry.entrada
    } else if (isFuture) {
      entrada = getProjectedForDay(year, month, d, fixos, 'entrada')
      entradaIsProjected = entrada > 0
    }

    let saida = 0
    let saidaIsProjected = false
    if (entry?.saida !== undefined) {
      saida = entry.saida
    } else if (isFuture) {
      const fixoSaida = getProjectedForDay(year, month, d, fixos, 'saida')
      saida = fixoSaida
      saidaIsProjected = fixoSaida > 0
    }

    const diario = getDiarioTotal(entry)

    runSaldo = runSaldo + entrada - saida - diario
    rows.push({ day: d, date: key, entrada, saida, diario, saldo: runSaldo, entradaIsProjected, saidaIsProjected })
  }

  return rows
}

function getOriginMonth(data: AppData): string {
  const months: string[] = [
    ...Object.keys(data.dias).map((d) => d.slice(0, 7)),
    ...(data.fixos ?? []).map((f) => f.inicio),
  ].filter(Boolean)
  if (months.length === 0) return '9999-12'
  return months.sort()[0]
}

export function getStartSaldoForMonth(
  year: number,
  month: number,
  data: AppData,
  todayStr: string,
  cache: Map<string, number> = new Map(),
): number {
  const key = yyyymmStr(year, month)
  if (cache.has(key)) return cache.get(key)!

  const origin = getOriginMonth(data)
  if (key <= origin) {
    cache.set(key, data.saldoInicial)
    return data.saldoInicial
  }

  const [py, pm] = prevMonth(year, month)
  const prevStart = getStartSaldoForMonth(py, pm, data, todayStr, cache)
  const rows = getMonthRows(py, pm, prevStart, data.dias, data.fixos ?? [], todayStr)
  const baseEnd = rows.length > 0 ? rows[rows.length - 1].saldo : prevStart
  // Desconta custos de projetos do mês anterior no saldo corrido
  const projetosCost = getProjetosCostForMonth(data.projetos ?? [], yyyymmStr(py, pm))
  const endSaldo = baseEnd - projetosCost

  cache.set(key, endSaldo)
  return endSaldo
}

export function getMonthSummary(rows: DaySaldoRow[], startSaldo: number): MonthSummary {
  const totalEntradas = rows.reduce((s, r) => s + r.entrada, 0)
  const totalSaidas = rows.reduce((s, r) => s + r.saida, 0)
  const totalDiario = rows.reduce((s, r) => s + r.diario, 0)
  const saidaTotal = totalSaidas + totalDiario
  const performance = totalEntradas - saidaTotal
  const saldoFinal = rows.length > 0 ? rows[rows.length - 1].saldo : startSaldo
  return { totalEntradas, totalSaidas, totalDiario, saidaTotal, performance, saldoFinal, startSaldo }
}

export function getSaldoStatus(saldo: number, reservaMinima: number): SaldoStatus {
  if (saldo < 0) return 'red'
  if (saldo < reservaMinima) return 'yellow'
  return 'green'
}

export function fmtBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value)
}

export function fmtBRLCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000)
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(value)
  if (Math.abs(value) >= 1_000)
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
  return fmtBRL(value)
}

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
