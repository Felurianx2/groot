// Vercel Serverless Function — grootapp.vercel.app/api/share/{token}
// Retorna um JSON legível por qualquer cliente (Claude, curl, etc.)
// sem precisar de JavaScript no navegador.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

function yyyymmStr(y: number, m: number) {
  return `${y}-${String(m).padStart(2, '0')}`
}
function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate()
}
function dateStr(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

interface DayEntry {
  entrada?: number
  saida?: number
  saidaItens?: { valor: number; nota: string }[]
  diario?: number
  diarioItens?: { valor: number; nota: string }[]
  entradaNota?: string
  saidaNota?: string
}

interface Fixo {
  id: string; tipo: 'entrada' | 'saida'; dia: number
  valor: number; descricao: string; inicio: string; fim: string | null
}

interface AppData {
  saldoInicial: number
  reservaMinima: number
  horizonteMeses: number
  dias: Record<string, DayEntry>
  fixos: Fixo[]
  economia: Record<string, number>
  projetos?: unknown[]
}

function getDiarioTotal(entry: DayEntry | undefined): number {
  if (!entry) return 0
  if (entry.diarioItens?.length) return entry.diarioItens.reduce((s, i) => s + i.valor, 0)
  return entry.diario ?? 0
}

function getSaidaTotal(entry: DayEntry | undefined): number {
  if (!entry) return 0
  if (entry.saidaItens?.length) return entry.saidaItens.reduce((s, i) => s + i.valor, 0)
  return entry.saida ?? 0
}

function computeMonthSummary(data: AppData, year: number, month: number) {
  const mm = yyyymmStr(year, month)
  const n = daysInMonth(year, month)
  const today = new Date().toISOString().slice(0, 10)

  let entradas = 0, saidas = 0, diario = 0
  const dias: { dia: number; entrada: number; saida: number; diario: number; itens: string[] }[] = []

  for (let d = 1; d <= n; d++) {
    const key = dateStr(year, month, d)
    const entry = data.dias[key]
    const isFuture = key > today

    let e = 0, s = 0, di = 0
    if (entry?.entrada !== undefined) {
      e = entry.entrada
    } else if (isFuture) {
      e = data.fixos
        .filter(f => f.tipo === 'entrada' && f.inicio <= mm && (f.fim === null || f.fim >= mm) && f.dia === d)
        .reduce((sum, f) => sum + f.valor, 0)
    }

    const fixoSaida = data.fixos
      .filter(f => f.tipo === 'saida' && f.inicio <= mm && (f.fim === null || f.fim >= mm) && f.dia === d)
      .reduce((sum, f) => sum + f.valor, 0)

    if (entry?.saidaItens?.length) {
      s = getSaidaTotal(entry) + fixoSaida
    } else if (entry?.saida !== undefined) {
      s = entry.saida
    } else if (isFuture) {
      s = fixoSaida
    }

    di = getDiarioTotal(entry)
    entradas += e; saidas += s; diario += di

    const itens: string[] = []
    if (entry?.diarioItens?.length) {
      entry.diarioItens.forEach(i => itens.push(`  diário: ${i.nota} ${fmtBRL(i.valor)}`))
    }
    if (entry?.saidaItens?.length) {
      entry.saidaItens.forEach(i => itens.push(`  saída: ${i.nota} ${fmtBRL(i.valor)}`))
    }

    if (e > 0 || s > 0 || di > 0) {
      dias.push({ dia: d, entrada: e, saida: s, diario: di, itens })
    }
  }

  return {
    mes: `${MONTH_NAMES[month - 1]} ${year}`,
    entradas, saidas, diario,
    saidaTotal: saidas + diario,
    performance: entradas - saidas - diario,
    dias,
  }
}

export default async function handler(req: { query: Record<string, string> }, res: {
  status: (c: number) => { json: (d: unknown) => void; end: () => void }
  setHeader: (k: string, v: string) => void
}) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  const token = req.query.token
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return res.status(400).json({ erro: 'Token inválido' })
  }

  let data: AppData | null = null
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_shared_budget`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ p_token: token }),
    })
    data = await r.json() as AppData | null
  } catch {
    return res.status(500).json({ erro: 'Erro ao buscar dados' })
  }

  if (!data) {
    return res.status(404).json({ erro: 'Link inválido ou revogado' })
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const mm = yyyymmStr(year, month)

  const mesAtual = computeMonthSummary(data, year, month)

  // Próximos 3 meses (simplificado: só fixos)
  const proximos = Array.from({ length: 3 }, (_, i) => {
    let y = year, m = month + i + 1
    if (m > 12) { m -= 12; y += 1 }
    const mmF = yyyymmStr(y, m)
    const totalEntradas = data!.fixos
      .filter(f => f.tipo === 'entrada' && f.inicio <= mmF && (f.fim === null || f.fim >= mmF))
      .reduce((s, f) => s + f.valor, 0)
    const totalSaidas = data!.fixos
      .filter(f => f.tipo === 'saida' && f.inicio <= mmF && (f.fim === null || f.fim >= mmF))
      .reduce((s, f) => s + f.valor, 0)
    return {
      mes: `${MONTH_NAMES[m - 1]} ${y}`,
      entradasFixas: totalEntradas,
      saidasFixas: totalSaidas,
      performanceEsperada: totalEntradas - totalSaidas,
    }
  })

  const fixosAtivos = data.fixos.filter(f => f.inicio <= mm && (f.fim === null || f.fim >= mm))

  const resultado = {
    _info: 'Groot — Finanças pessoais. Dados somente leitura.',
    _geradoEm: now.toISOString(),
    configuracoes: {
      saldoInicial: data.saldoInicial,
      reservaMinima: data.reservaMinima,
    },
    mesAtual,
    projecaoProximos3Meses: proximos,
    fixosAtivos: {
      entradas: fixosAtivos
        .filter(f => f.tipo === 'entrada')
        .map(f => ({ descricao: f.descricao, valor: f.valor, dia: f.dia })),
      saidas: fixosAtivos
        .filter(f => f.tipo === 'saida')
        .map(f => ({ descricao: f.descricao, valor: f.valor, dia: f.dia })),
    },
    projetos: (data.projetos ?? []).map((p: any) => ({
      nome: p.nome,
      prazo: p.prazo,
      concluido: p.concluido,
      total: (p.itens ?? []).reduce((s: number, i: any) => s + i.valor, 0),
      itens: (p.itens ?? []).map((i: any) => ({
        nome: i.nome, valor: i.valor,
        parcelas: i.parcelas ?? 1, frequencia: i.frequencia ?? 'mensal',
      })),
    })),
  }

  return res.status(200).json(resultado)
}
