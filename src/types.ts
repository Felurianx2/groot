export interface DiarioItem {
  id: string
  valor: number
  nota: string
}

export interface DayEntry {
  entrada?: number
  entradaNota?: string
  saida?: number          // backward compat; ignorado quando saidaItens presente
  saidaNota?: string
  saidaItens?: DiarioItem[]
  diario?: number         // backward compat; ignorado quando diarioItens presente
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
  projetos?: Projeto[]
}

export interface ProjetoItem {
  id: string
  nome: string
  valor: number
  parcelas?: number               // 1 = à vista (default)
  frequencia?: 'mensal' | 'semanal' // default 'mensal'
  parcelaInicio?: string          // "YYYY-MM" (mensal) ou "YYYY-MM-DD" (semanal)
}

export interface Projeto {
  id: string
  nome: string
  prazo: string | null // "YYYY-MM-DD" or null
  itens: ProjetoItem[]
  concluido: boolean
  compartilhado?: boolean   // visível para o(a) parceiro(a) na aba Casal/Projetos
}

export type SaldoStatus = 'green' | 'yellow' | 'red'

export type ActiveView = 'month' | 'year' | 'fixos' | 'economia' | 'projetos' | 'casal' | 'config'
