// src/hooks/useCaixaPrevisto.ts
import { useMemo } from 'react'
import { LancamentoFinanceiro } from '@/types'
import { getDataAtualBrasil, formatarDataParaExibicao } from '@/lib/dateUtils'
import { useLancamentosFinanceiros } from './useLancamentosFinanceiros'

interface DiaCaixa {
  data: string
  data_formatada: string
  receitas: number
  despesas: number
  saldo_acumulado: number
}

const toNumero = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const calcularPrevisaoCaixa = (lancamentosCasa: LancamentoFinanceiro[]) => {
  const hoje = getDataAtualBrasil()

  const realCasa = lancamentosCasa
    .filter(l => String(l.status ?? '').trim().toLowerCase() === 'realizado')
    .reduce((acc, l) => {
      const tipo = String(l.tipo ?? '').trim().toLowerCase()
      const valor = toNumero(l.valor)
      return acc + (tipo === 'entrada' ? valor : -valor)
    }, 0)

  const groupedCasa: Record<string, { receitas: number; despesas: number }> = {}
  const allDatesSet = new Set<string>()

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

  lancamentosCasa.forEach(l => {
    const status = String(l.status ?? '').trim().toLowerCase()
    const tipo = String(l.tipo ?? '').trim().toLowerCase()
    const data =
      (status === 'realizado'
        ? extrairDataDia(l.data_lancamento) ?? extrairDataDia(l.data_prevista)
        : extrairDataDia(l.data_prevista) ?? extrairDataDia(l.data_lancamento)) ??
      extrairDataDia((l as unknown as { data?: string }).data)

    if (!data || !isDataISOValida(data)) return

    allDatesSet.add(data)

    const valor = toNumero(l.valor)
    if (!groupedCasa[data]) groupedCasa[data] = { receitas: 0, despesas: 0 }

    if (tipo === 'entrada') groupedCasa[data].receitas += valor
    else groupedCasa[data].despesas += valor
  })

  const sortedDates = Array.from(allDatesSet).sort()

  if (sortedDates.length === 0) {
    return {
      caixaRealCasa: realCasa,
      casa: { series: [], entradasHoje: 0, saidasHoje: 0 },
    }
  }

  const minDate = sortedDates[0]
  const maxDate = sortedDates[sortedDates.length - 1]

  const seriesCasa: DiaCaixa[] = []
  let saldoCasa = 0

  const currentDate = new Date(`${minDate}T12:00:00`)
  const finalDate = new Date(`${maxDate}T12:00:00`)

  while (currentDate <= finalDate) {
    const d = currentDate.toISOString().split('T')[0]
    const c = groupedCasa[d] || { receitas: 0, despesas: 0 }

    saldoCasa += c.receitas - c.despesas

    seriesCasa.push({
      data: d,
      data_formatada: formatarDataParaExibicao(d),
      receitas: c.receitas,
      despesas: c.despesas,
      saldo_acumulado: saldoCasa,
    })

    currentDate.setDate(currentDate.getDate() + 1)
  }

  const casaHoje = groupedCasa[hoje] || { receitas: 0, despesas: 0 }

  return {
    caixaRealCasa: realCasa,
    casa: { series: seriesCasa, entradasHoje: casaHoje.receitas, saidasHoje: casaHoje.despesas },
  }
}

export function useCaixaPrevisto() {
  const { data: lancamentosCasa = [], isLoading, isSuccess } = useLancamentosFinanceiros()
  const data = useMemo(
    () => (isSuccess ? calcularPrevisaoCaixa(lancamentosCasa) : undefined),
    [isSuccess, lancamentosCasa]
  )

  return {
    data,
    isLoading,
  }
}
