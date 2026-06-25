export interface DiarioItem {
  id: string
  valor: number
  nota: string
}

export interface DayEntry {
  entrada?: number
  entradaNota?: string
  saida?: number
  saidaNota?: string
  diario?: number // backward compat; ignored when diarioItens present
  diarioItens?: DiarioItem[]
}

export interface Fixo {
  id: string
  dia: number // 1–31
  tipo: 'entrada' | 'saida'
  valor: number
  descricao: string
  inicio: string // "YYYY-MM"
  fim: string | null // "YYYY-MM" or null = forever
}

export interface AppData {
  saldoInicial: number
  reservaMinima: number
  horizonteMeses: number
  dias: Record<string, DayEntry>
  fixos: Fixo[]
  economia: Record<string, number> // "YYYY-MM": value
  notasAno: Record<string, string> // "YYYY": text
}

export type SaldoStatus = 'green' | 'yellow' | 'red'

export type ActiveView = 'month' | 'year' | 'fixos' | 'economia' | 'config'
