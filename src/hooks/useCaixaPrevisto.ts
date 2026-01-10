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
// Ela não busca dados, apenas os processa.
const calcularPrevisaoCaixa = (
  transacoesLoja: TransacaoLoja[],
  lancamentosCasa: LancamentoFinanceiro[]
) => {
  console.log('[DEBUG] Executando cálculo pesado de Previsão de Caixa...')

  const calcularDataNDias = (dataBase: string, dias: number) => {
    const data = new Date(`${dataBase}T12:00:00`)
    data.setDate(data.getDate() + dias)
    return data.toISOString().split('T')[0]
  }

  const hoje = getDataAtualBrasil()
  const ontem = calcularDataNDias(hoje, -1)

  const realLoja = transacoesLoja
    .filter(t => t.status_pagamento === 'pago')
    .reduce((acc, t) => acc + (t.tipo === 'entrada' ? (t.valor_pago ?? t.total) : -(t.valor_pago ?? t.total)), 0)

  const realCasa = lancamentosCasa
    .filter(l => l.status === 'realizado')
    .reduce((acc, l) => acc + (l.tipo === 'entrada' ? l.valor : -l.valor), 0)

  const realGeral = realLoja + realCasa

  const saldoAteOntemLoja = transacoesLoja
    .filter(t => t.status_pagamento === 'pago' && t.data_pagamento && t.data_pagamento <= ontem)
    .reduce((acc, t) => acc + (t.tipo === 'entrada' ? (t.valor_pago ?? t.total) : -(t.valor_pago ?? t.total)), 0)

  const saldoAteOntemCasa = lancamentosCasa
    .filter(l => l.status === 'realizado' && l.data_lancamento && l.data_lancamento <= ontem)
    .reduce((acc, l) => acc + (l.tipo === 'entrada' ? l.valor : -l.valor), 0)

  const saldoInicialProjecao = saldoAteOntemLoja + saldoAteOntemCasa

  const allEntries: { data: string; valor: number }[] = []
  transacoesLoja.forEach(t => {
    const data = t.status_pagamento === 'pago' ? t.data_pagamento : t.data
    if (!data || data < hoje) return
    const valor = t.valor_pago ?? t.total
    allEntries.push({ data: data.split('T')[0], valor: t.tipo === 'entrada' ? valor : -valor })
  })
  lancamentosCasa.forEach(l => {
    const data = l.status === 'realizado' ? l.data_lancamento : l.data_prevista
    if (!data || data < hoje) return
    allEntries.push({ data: data.split('T')[0], valor: l.tipo === 'entrada' ? l.valor : -l.valor })
  })

  const groupedByDate = allEntries.reduce((acc, curr) => {
    if (!acc[curr.data]) {
      acc[curr.data] = { receitas: 0, despesas: 0 }
    }
    if (curr.valor > 0) acc[curr.data].receitas += curr.valor
    else acc[curr.data].despesas += Math.abs(curr.valor)
    return acc
  }, {} as Record<string, { receitas: number; despesas: number }>)

  const hojeData = groupedByDate[hoje] || { receitas: 0, despesas: 0 }
  const entradasHoje = hojeData.receitas
  const saidasHoje = hojeData.despesas

  const sortedDates = Object.keys(groupedByDate).sort()
  const maxDate = sortedDates[sortedDates.length - 1] || calcularDataNDias(hoje, 30)
  const series: DiaCaixa[] = []
  let saldoAcumulado = saldoInicialProjecao
  const currentDate = new Date(`${hoje}T12:00:00`)
  const finalDate = new Date(`${maxDate}T12:00:00`)

  while (currentDate <= finalDate) {
    const dateStr = currentDate.toISOString().split('T')[0]
    const { receitas, despesas } = groupedByDate[dateStr] || { receitas: 0, despesas: 0 }
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

  return {
    caixaRealGeral: realGeral,
    caixaRealLoja: realLoja,
    caixaRealCasa: realCasa,
    series,
    entradasHoje,
    saidasHoje,
  }
}

// 2. O novo hook busca os dados brutos e usa um NOVO useQuery para CACHEAR o resultado do cálculo.
export function useCaixaPrevisto() {
  const { data: transacoesLoja = [], isSuccess: transacoesSuccess } = useTransacoesLoja()
  const { data: lancamentosCasa = [], isSuccess: lancamentosSuccess } = useLancamentosFinanceiros()

  return useQuery({
    // A chave da query agora inclui os próprios dados. Se os dados mudarem, a chave muda,
    // e o React Query executa o cálculo novamente.
    queryKey: ['caixa_previsto_calculado', transacoesLoja, lancamentosCasa],
    // A função da query é a nossa função de cálculo pura.
    queryFn: () => calcularPrevisaoCaixa(transacoesLoja, lancamentosCasa),
    // O cálculo só é executado quando os dados brutos estiverem prontos.
    enabled: transacoesSuccess && lancamentosSuccess,
  })
}
