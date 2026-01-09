// hooks/useCaixaUniversal.ts
import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { subscribeToChanges } from '@/lib/realtime'
import { getDataAtualBrasil, formatarDataParaExibicao } from '@/lib/dateUtils'

interface DiaCaixa {
  data: string
  data_formatada: string
  receitas: number
  despesas: number
  saldo_acumulado: number
}

type Filtro = '30dias' | 'mes' | 'tudo'

const calcularDataNDias = (dataBase: string, dias: number) => {
  const data = new Date(`${dataBase}T12:00:00`)
  data.setDate(data.getDate() + dias)
  return data.toISOString().split('T')[0]
}

const fetchAll = async <T>(
  fromTable: string,
  selectFields = '*',
  orderColumn = 'id',
): Promise<T[]> => {
  const pageSize = 1000
  let offset = 0
  const all: T[] = []

  while (true) {
    const { data, error } = await supabase
      .from(fromTable)
      .select(selectFields)
      .order(orderColumn, { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    all.push(...(data as T[]))
    if (data.length < pageSize) break
    offset += pageSize
  }
  return all
}

const fetchCaixaData = async (filtro: Filtro /*, mesFiltro: string */) => {
  const hoje = getDataAtualBrasil()
  const ontem = calcularDataNDias(hoje, -1)

  if (filtro === 'mes') {
    // const [ano, mes] = mesFiltro.split('-')
    // const primeiroDia = `${ano}-${mes}-01`
    // const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).toISOString().split('T')[0]
    // queryLoja = queryLoja.gte('data', primeiroDia).lte('data', ultimoDia)
    // queryCasa = queryCasa.gte('data_prevista', primeiroDia).lte('data_prevista', ultimoDia)
  }

  const [transacoesLoja, lancamentosCasa] = await Promise.all([
    fetchAll(
      'transacoes_loja',
      'tipo, total, valor_pago, data, data_pagamento, status_pagamento',
      'data',
    ),
    fetchAll(
      'lancamentos_financeiros',
      'tipo, valor, data_prevista, data_lancamento, status',
      'data_prevista',
    ),
  ])

  const realLoja = transacoesLoja
    .filter((t) => t.status_pagamento === 'pago')
    .reduce(
      (acc, t) =>
        acc +
        (t.tipo === 'entrada'
          ? t.valor_pago ?? t.total
          : -(t.valor_pago ?? t.total)),
      0,
    )

  const realCasa = lancamentosCasa
    .filter((l) => l.status === 'realizado')
    .reduce((acc, l) => acc + (l.tipo === 'entrada' ? l.valor : -l.valor), 0)

  const saldoAteOntemLoja = transacoesLoja
    .filter(
      (t) =>
        t.status_pagamento === 'pago' &&
        t.data_pagamento &&
        t.data_pagamento <= ontem,
    )
    .reduce(
      (acc, t) =>
        acc +
        (t.tipo === 'entrada'
          ? t.valor_pago ?? t.total
          : -(t.valor_pago ?? t.total)),
      0,
    )

  const saldoAteOntemCasa = lancamentosCasa
    .filter(
      (l) =>
        l.status === 'realizado' &&
        l.data_lancamento &&
        l.data_lancamento <= ontem,
    )
    .reduce((acc, l) => acc + (l.tipo === 'entrada' ? l.valor : -l.valor), 0)

  const saldoInicialProjecao = saldoAteOntemLoja + saldoAteOntemCasa

  const allEntries: { data: string; valor: number }[] = []
  transacoesLoja.forEach((t) => {
    const data = t.status_pagamento === 'pago' ? t.data_pagamento : t.data
    if (!data || data < hoje) return
    const valor = t.valor_pago ?? t.total
    allEntries.push({
      data: data.split('T')[0],
      valor: t.tipo === 'entrada' ? valor : -valor,
    })
  })
  lancamentosCasa.forEach((l) => {
    const data = l.status === 'realizado' ? l.data_lancamento : l.data_prevista
    if (!data || data < hoje) return
    allEntries.push({
      data: data.split('T')[0],
      valor: l.tipo === 'entrada' ? l.valor : -l.valor,
    })
  })

  const groupedByDate = allEntries.reduce(
    (acc, curr) => {
      if (!acc[curr.data]) {
        acc[curr.data] = { receitas: 0, despesas: 0 }
      }
      if (curr.valor > 0) acc[curr.data].receitas += curr.valor
      else acc[curr.data].despesas += Math.abs(curr.valor)
      return acc
    },
    {} as Record<string, { receitas: number; despesas: number }>,
  )

  const hojeData = groupedByDate[hoje] || { receitas: 0, despesas: 0 }

  const sortedDates = Object.keys(groupedByDate).sort()
  const maxDate = sortedDates[sortedDates.length - 1] || calcularDataNDias(hoje, 30)

  const series: DiaCaixa[] = []
  let saldoAcumulado = saldoInicialProjecao

  const currentDate = new Date(`${hoje}T12:00:00`)
  const finalDate = new Date(`${maxDate}T12:00:00`)

  while (currentDate <= finalDate) {
    const dateStr = currentDate.toISOString().split('T')[0]
    const { receitas, despesas } = groupedByDate[dateStr] || {
      receitas: 0,
      despesas: 0,
    }
    saldoAcumulado += receitas - despesas
    series.push({
      data: dateStr,
      data_formatada: formatarDataParaExibicao(dateStr),
      receitas,
      despesas,
      saldo_acumulado: saldoAcumulado,
    })
    currentDate.setDate(currentDate.getDate() + 1)
  }

  let displaySeries = series
  if (filtro === '30dias') {
    const dataLimite = calcularDataNDias(hoje, 29)
    displaySeries = series.filter((dia) => dia.data <= dataLimite)
  }

  return {
    caixaRealGeral: realLoja + realCasa,
    caixaRealLoja: realLoja,
    caixaRealCasa: realCasa,
    caixaPrevistoGeral: displaySeries,
    entradasHoje: hojeData.receitas,
    saidasHoje: hojeData.despesas,
  }
}

export function useCaixaUniversal() {
  const [filtro, setFiltro] = useState<Filtro>('30dias')
  const [mesFiltro, setMesFiltro] = useState(() => {
    const hoje = new Date()
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  })
  const queryClient = useQueryClient()

  useEffect(() => {
    const subscription = subscribeToChanges(queryClient)
    return () => {
      subscription.unsubscribe()
    }
  }, [queryClient])

  const {
    data,
    isLoading: carregando,
    isError,
  } = useQuery({
    queryKey: ['caixaUniversal', filtro, mesFiltro],
    queryFn: async () => {
      const result = await fetchCaixaData(filtro, mesFiltro)
      return { ...result, lastUpdated: Date.now() }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  })

  const getTituloPrevisao = useCallback(() => {
    if (filtro === 'tudo') return 'Histórico e Futuro'
    if (filtro === '30dias') {
      const hoje = getDataAtualBrasil()
      const fim30Dias = calcularDataNDias(hoje, 29)
      return `Próximos 30 Dias: ${formatarDataParaExibicao(
        hoje,
      )} a ${formatarDataParaExibicao(fim30Dias)}`
    }
    if (filtro === 'mes' && mesFiltro) {
      const [ano, mes] = mesFiltro.split('-')
      return `Mês: ${mes}/${ano}`
    }
    return 'Período'
  }, [filtro, mesFiltro])

  return {
    caixaRealGeral: data?.caixaRealGeral ?? 0,
    caixaRealLoja: data?.caixaRealLoja ?? 0,
    caixaRealCasa: data?.caixaRealCasa ?? 0,
    caixaPrevistoGeral: data?.caixaPrevistoGeral ?? [],
    entradasHoje: data?.entradasHoje ?? 0,
    saidasHoje: data?.saidasHoje ?? 0,
    carregando,
    isError,
    filtro,
    setFiltro,
    mesFiltro,
    setMesFiltro,
    getTituloPrevisao,
    ultimaAtualizacao: data?.lastUpdated ?? 0,
  }
}