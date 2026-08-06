// hooks/useCaixaGeral.ts — VERSÃO MULTI-BANCO
// Soma o caixa real e a previsão diária dos 2 projetos (Lucius + usemaju)
import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabaseUsemaju } from '@/lib/supabaseUsemaju'
import { useCaixaPrevisto } from '@/hooks/useCaixaPrevisto'
import { getDataAtualBrasil, formatarDataParaExibicao } from '@/lib/dateUtils'

type Filtro = '30dias' | 'mes' | 'tudo'

interface DiaCaixa {
  data: string
  data_formatada: string
  receitas: number
  despesas: number
  saldo_acumulado: number
}

interface LancamentoUsemaju {
  id: number
  tipo: string
  status: string
  valor_parcela: number
  data_vencimento: string
  data_pagamento?: string
}

// Busca todos os lançamentos do financeiro do usemaju (paginação)
const fetchLancamentosUsemaju = async (): Promise<LancamentoUsemaju[]> => {
  const all: LancamentoUsemaju[] = []
  const PAGE_SIZE = 1000
  const MAX_PAGES = 50

  for (let page = 0; page < MAX_PAGES; page++) {
    let query = supabaseUsemaju
      .from('financeiro_lancamentos')
      .select('id,tipo,status,valor_parcela,data_vencimento,data_pagamento')
      .order('id', { ascending: false })
      .limit(PAGE_SIZE)

    if (page > 0) {
      query = query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar lançamentos usemaju:', error)
      throw new Error('Não foi possível buscar os lançamentos do usemaju')
    }

    if (!data || data.length === 0) break

    all.push(...(data as unknown as LancamentoUsemaju[]))

    if (data.length < PAGE_SIZE) break
  }

  return all
}

const toNumero = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const extrairDataDia = (v: unknown): string | null => {
  if (!v) return null
  const s = String(v)
  return s.split('T')[0] || null
}

const isDataISOValida = (dataISO: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) return false
  const [y, m, d] = dataISO.split('-').map(Number)
  const dt = new Date(`${dataISO}T12:00:00`)
  if (Number.isNaN(dt.getTime())) return false
  return dt.getFullYear() === y && dt.getMonth() + 1 === m && dt.getDate() === d
}

// Monta os dados do caixa do usemaju no MESMO formato do caixa da casa (Lucius)
const calcularCaixaUsemaju = (lancamentos: LancamentoUsemaju[]) => {
  const hoje = getDataAtualBrasil()

  const realUsemaju = lancamentos
    .filter(l => String(l.status ?? '').trim().toLowerCase() === 'pago')
    .reduce((acc, l) => {
      const tipo = String(l.tipo ?? '').trim().toLowerCase()
      const valor = toNumero(l.valor_parcela)
      // venda => entra (receita), compra => sai (despesa)
      return acc + (tipo === 'venda' ? valor : -valor)
    }, 0)

  const grouped: Record<string, { receitas: number; despesas: number }> = {}
  const allDatesSet = new Set<string>()

  lancamentos.forEach(l => {
    const status = String(l.status ?? '').trim().toLowerCase()
    const tipo = String(l.tipo ?? '').trim().toLowerCase()
    const data =
      (status === 'pago'
        ? extrairDataDia(l.data_pagamento) ?? extrairDataDia(l.data_vencimento)
        : extrairDataDia(l.data_vencimento) ?? extrairDataDia(l.data_pagamento))

    if (!data || !isDataISOValida(data)) return

    allDatesSet.add(data)

    const valor = toNumero(l.valor_parcela)
    if (!grouped[data]) grouped[data] = { receitas: 0, despesas: 0 }

    if (tipo === 'venda') grouped[data].receitas += valor
    else grouped[data].despesas += valor
  })

  const sortedDates = Array.from(allDatesSet).sort()

  if (sortedDates.length === 0) {
    return { caixaRealUsemaju: realUsemaju, series: [] as DiaCaixa[], entradasHoje: 0, saidasHoje: 0 }
  }

  const minDate = sortedDates[0]
  const maxDate = sortedDates[sortedDates.length - 1]

  const seriesUsemaju: DiaCaixa[] = []
  let saldoUsemaju = 0

  const currentDate = new Date(`${minDate}T12:00:00`)
  const finalDate = new Date(`${maxDate}T12:00:00`)

  while (currentDate <= finalDate) {
    const d = currentDate.toISOString().split('T')[0]
    const c = grouped[d] || { receitas: 0, despesas: 0 }

    saldoUsemaju += c.receitas - c.despesas

    seriesUsemaju.push({
      data: d,
      data_formatada: formatarDataParaExibicao(d),
      receitas: c.receitas,
      despesas: c.despesas,
      saldo_acumulado: saldoUsemaju,
    })

    currentDate.setDate(currentDate.getDate() + 1)
  }

  const hojeUsemaju = grouped[hoje] || { receitas: 0, despesas: 0 }

  return {
    caixaRealUsemaju: realUsemaju,
    series: seriesUsemaju,
    entradasHoje: hojeUsemaju.receitas,
    saidasHoje: hojeUsemaju.despesas,
  }
}

// Tipos de retorno do useCaixaPrevisto (casa/Lucius)
export function useCaixaGeral() {
  const [filtro, setFiltro] = useState<Filtro>('30dias')
  const [mesFiltro, setMesFiltro] = useState(() => {
    const hoje = new Date()
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  })

  // Dados do Lucius (hook já existente)
  const { data: dadosCalculados, isLoading: carregandoLucius } = useCaixaPrevisto()

  // Dados do usemaju (banco separado)
  const { data: lancamentosUsemaju = [], isLoading: carregandoUsemaju } = useQuery<LancamentoUsemaju[]>({
    queryKey: ['lancamentos_financeiros_usemaju'],
    queryFn: fetchLancamentosUsemaju,
  })

  const carregando = carregandoLucius || carregandoUsemaju

  const caixaRealLucius = dadosCalculados?.caixaRealCasa ?? 0
  const seriesLucius = useMemo(
    () => dadosCalculados?.casa?.series ?? [],
    [dadosCalculados]
  )
  const entradasHojeLucius = dadosCalculados?.casa?.entradasHoje ?? 0
  const saidasHojeLucius = dadosCalculados?.casa?.saidasHoje ?? 0

  const caixaUsemaju = useMemo(() => calcularCaixaUsemaju(lancamentosUsemaju), [lancamentosUsemaju])

  const caixaRealGeral = caixaRealLucius + caixaUsemaju.caixaRealUsemaju
  const entradasHoje = entradasHojeLucius + caixaUsemaju.entradasHoje
  const saidasHoje = saidasHojeLucius + caixaUsemaju.saidasHoje

  // Consolida as séries diárias dos dois caixas em uma série única (somando receitas/despesas por data)
  const seriesGeral = useMemo<DiaCaixa[]>(() => {
    const mapa = new Map<string, { receitas: number; despesas: number }>()

    ;[...seriesLucius, ...caixaUsemaju.series].forEach(dia => {
      const atual = mapa.get(dia.data) || { receitas: 0, despesas: 0 }
      mapa.set(dia.data, {
        receitas: atual.receitas + dia.receitas,
        despesas: atual.despesas + dia.despesas,
      })
    })

    const datasOrdenadas = Array.from(mapa.keys()).sort()

    if (datasOrdenadas.length === 0) return []

    let saldo = 0
    return datasOrdenadas.map(data => {
      const c = mapa.get(data)!
      saldo += c.receitas - c.despesas
      return {
        data,
        data_formatada: formatarDataParaExibicao(data),
        receitas: c.receitas,
        despesas: c.despesas,
        saldo_acumulado: saldo,
      }
    })
  }, [seriesLucius, caixaUsemaju.series])

  // Aplica o mesmo filtro do hook existente sobre a série geral
  const caixaPrevistoGeral = useMemo(() => {
    const hoje = getDataAtualBrasil()

    const calcularDataNDias = (dataBase: string, dias: number) => {
      const data = new Date(`${dataBase}T12:00:00`)
      data.setDate(data.getDate() + dias)
      return data.toISOString().split('T')[0]
    }

    switch (filtro) {
      case '30dias': {
        const dataLimite = calcularDataNDias(hoje, 29)
        return seriesGeral.filter(dia => dia.data >= hoje && dia.data <= dataLimite)
      }
      case 'mes': {
        if (mesFiltro) return seriesGeral.filter(dia => dia.data.startsWith(mesFiltro))
        return []
      }
      case 'tudo':
        return seriesGeral.filter(dia => dia.data >= hoje)
      default:
        return []
    }
  }, [seriesGeral, filtro, mesFiltro])

  const getTituloPrevisao = useCallback(() => {
    if (filtro === 'tudo') return 'Histórico e Futuro'
    if (filtro === '30dias') {
      const hoje = getDataAtualBrasil()
      const fim = (() => {
        const data = new Date(`${hoje}T12:00:00`)
        data.setDate(data.getDate() + 29)
        return data.toISOString().split('T')[0]
      })()
      return `Próximos 30 Dias: ${formatarDataParaExibicao(hoje)} a ${formatarDataParaExibicao(fim)}`
    }
    if (filtro === 'mes' && mesFiltro) {
      const [ano, mes] = mesFiltro.split('-')
      return `Mês: ${mes}/${ano}`
    }
    return 'Período'
  }, [filtro, mesFiltro])

  return {
    // Totais Gerais somados (Lucius + usemaju)
    caixaRealGeral,
    entradasHoje,
    saidasHoje,
    caixaPrevistoGeral,
    carregando,
    filtro,
    setFiltro,
    mesFiltro,
    setMesFiltro,
    getTituloPrevisao,
  }
}