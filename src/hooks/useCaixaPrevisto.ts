// src/hooks/useCaixaPrevisto.ts
import { useQuery } from '@tanstack/react-query'
import { LancamentoFinanceiro, TransacaoLoja } from '@/types'
import { getDataAtualBrasil, formatarDataParaExibicao } from '@/lib/dateUtils'
import { useLancamentosFinanceiros } from './useLancamentosFinanceiros'
import { useTransacoesLoja } from './useTransacoesLoja'

interface DiaCaixa {
  data: string
  data_formatada: string
  receitas: number
  despesas: number
  saldo_acumulado: number
}

// 1. A lógica de cálculo pesada foi extraída para uma função pura.
// Ela não busca dados, apenas os processa separadamente por módulo.
const calcularPrevisaoCaixa = (
  transacoesLoja: TransacaoLoja[],
  lancamentosCasa: LancamentoFinanceiro[]
) => {
  console.log('[DEBUG] Executando cálculo pesado de Previsão de Caixa (Separado por Módulo)...')

  const hoje = getDataAtualBrasil()

  // Real (Calculado para referência)
  const realLoja = transacoesLoja
    .filter(t => t.status_pagamento === 'pago')
    .reduce((acc, t) => acc + (t.tipo === 'entrada' ? (t.valor_pago ?? t.total) : -(t.valor_pago ?? t.total)), 0)

  const realCasa = lancamentosCasa
    .filter(l => l.status === 'realizado')
    .reduce((acc, l) => acc + (l.tipo === 'entrada' ? l.valor : -l.valor), 0)

  const realGeral = realLoja + realCasa

  // Agrupadores por data e módulo
  const groupedLoja: Record<string, { receitas: number; despesas: number }> = {}
  const groupedCasa: Record<string, { receitas: number; despesas: number }> = {}
  const groupedGeral: Record<string, { receitas: number; despesas: number }> = {}

  const allDatesSet = new Set<string>()

  // Processar Loja
  transacoesLoja.forEach(t => {
    const data = (t.status_pagamento === 'pago' ? t.data_pagamento : t.data)?.split('T')[0]
    if (!data) return
    allDatesSet.add(data)
    const valor = t.valor_pago ?? t.total

    if (!groupedLoja[data]) groupedLoja[data] = { receitas: 0, despesas: 0 }
    if (!groupedGeral[data]) groupedGeral[data] = { receitas: 0, despesas: 0 }

    if (t.tipo === 'entrada') {
      groupedLoja[data].receitas += valor
      groupedGeral[data].receitas += valor
    } else {
      groupedLoja[data].despesas += valor
      groupedGeral[data].despesas += valor
    }
  })

  // Processar Casa
  lancamentosCasa.forEach(l => {
    const data = (l.status === 'realizado' ? l.data_lancamento : l.data_prevista)?.split('T')[0]
    if (!data) return
    allDatesSet.add(data)
    const valor = l.valor

    if (!groupedCasa[data]) groupedCasa[data] = { receitas: 0, despesas: 0 }
    if (!groupedGeral[data]) groupedGeral[data] = { receitas: 0, despesas: 0 }

    if (l.tipo === 'entrada') {
      groupedCasa[data].receitas += valor
      groupedGeral[data].receitas += valor
    } else {
      groupedCasa[data].despesas += valor
      groupedGeral[data].despesas += valor
    }
  })

  const sortedDates = Array.from(allDatesSet).sort()

  if (sortedDates.length === 0) {
    return {
      caixaRealGeral: realGeral,
      caixaRealLoja: realLoja,
      caixaRealCasa: realCasa,
      loja: { series: [], entradasHoje: 0, saidasHoje: 0 },
      casa: { series: [], entradasHoje: 0, saidasHoje: 0 },
      geral: { series: [], entradasHoje: 0, saidasHoje: 0 },
    }
  }

  const minDate = sortedDates[0]
  const maxDate = sortedDates[sortedDates.length - 1]

  const seriesLoja: DiaCaixa[] = []
  const seriesCasa: DiaCaixa[] = []
  const seriesGeral: DiaCaixa[] = []

  let saldoLoja = 0
  let saldoCasa = 0
  let saldoGeral = 0

  const currentDate = new Date(`${minDate}T12:00:00`)
  const finalDate = new Date(`${maxDate}T12:00:00`)

  while (currentDate <= finalDate) {
    const d = currentDate.toISOString().split('T')[0]
    const df = formatarDataParaExibicao(d)

    const l = groupedLoja[d] || { receitas: 0, despesas: 0 }
    const c = groupedCasa[d] || { receitas: 0, despesas: 0 }
    const g = groupedGeral[d] || { receitas: 0, despesas: 0 }

    saldoLoja += l.receitas - l.despesas
    saldoCasa += c.receitas - c.despesas
    saldoGeral += g.receitas - g.despesas

    seriesLoja.push({ data: d, data_formatada: df, receitas: l.receitas, despesas: l.despesas, saldo_acumulado: saldoLoja })
    seriesCasa.push({ data: d, data_formatada: df, receitas: c.receitas, despesas: c.despesas, saldo_acumulado: saldoCasa })
    seriesGeral.push({ data: d, data_formatada: df, receitas: g.receitas, despesas: g.despesas, saldo_acumulado: saldoGeral })

    currentDate.setDate(currentDate.getDate() + 1)
  }

  const lojaHoje = groupedLoja[hoje] || { receitas: 0, despesas: 0 }
  const casaHoje = groupedCasa[hoje] || { receitas: 0, despesas: 0 }
  const geralHoje = groupedGeral[hoje] || { receitas: 0, despesas: 0 }

  return {
    caixaRealGeral: realGeral,
    caixaRealLoja: realLoja,
    caixaRealCasa: realCasa,
    loja: { series: seriesLoja, entradasHoje: lojaHoje.receitas, saidasHoje: lojaHoje.despesas },
    casa: { series: seriesCasa, entradasHoje: casaHoje.receitas, saidasHoje: casaHoje.despesas },
    geral: { series: seriesGeral, entradasHoje: geralHoje.receitas, saidasHoje: geralHoje.despesas },
  }
}

// 2. O novo hook busca os dados brutos e usa um NOVO useQuery para CACHEAR o resultado do cálculo.
export function useCaixaPrevisto() {
  const { data: transacoesLoja = [], isSuccess: transacoesSuccess } = useTransacoesLoja()
  const { data: lancamentosCasa = [], isSuccess: lancamentosSuccess } = useLancamentosFinanceiros()

  return useQuery({
    queryKey: ['caixa_previsto_calculado_v2', transacoesLoja, lancamentosCasa],
    queryFn: () => calcularPrevisaoCaixa(transacoesLoja, lancamentosCasa),
    enabled: transacoesSuccess && lancamentosSuccess,
  })
}
