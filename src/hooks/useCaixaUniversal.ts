// hooks/useCaixaUniversal.ts - VERSÃO FINAL OTIMIZADA
import { useState, useMemo, useCallback } from 'react'
import { useCaixaPrevisto } from './useCaixaPrevisto'
import { getDataAtualBrasil, formatarDataParaExibicao } from '@/lib/dateUtils'

type Filtro = '30dias' | 'mes' | 'tudo'

export function useCaixaUniversal() {
  const [filtro, setFiltro] = useState<Filtro>('30dias')
  const [mesFiltro, setMesFiltro] = useState(() => {
    const hoje = new Date()
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  })

  // 1. Consumir os dados JÁ CALCULADOS E CACHEADOS do novo hook.
  const { data: dadosCalculados, isLoading: carregando } = useCaixaPrevisto()

  const calcularDataNDias = useCallback((dataBase: string, dias: number) => {
    const data = new Date(`${dataBase}T12:00:00`)
    data.setDate(data.getDate() + dias)
    return data.toISOString().split('T')[0]
  }, [])

  // 2. A única lógica que permanece aqui é a de FILTRAGEM da série de dados.
  // Isso é muito mais leve e rápido do que o cálculo completo.
  const caixaPrevistoGeral = useMemo(() => {
    if (!dadosCalculados?.series) {
      return []
    }

    if (filtro === '30dias') {
      const hoje = getDataAtualBrasil()
      const dataLimite = calcularDataNDias(hoje, 29)
      return dadosCalculados.series.filter(dia => dia.data <= dataLimite)
    }

    if (filtro === 'mes' && mesFiltro) {
      return dadosCalculados.series.filter(dia => dia.data.startsWith(mesFiltro))
    }

    return dadosCalculados.series
  }, [dadosCalculados, filtro, mesFiltro, calcularDataNDias])

  return {
    // Retorna os dados diretamente do cache do useCaixaPrevisto
    caixaRealGeral: dadosCalculados?.caixaRealGeral ?? 0,
    caixaRealLoja: dadosCalculados?.caixaRealLoja ?? 0,
    caixaRealCasa: dadosCalculados?.caixaRealCasa ?? 0,
    entradasHoje: dadosCalculados?.entradasHoje ?? 0,
    saidasHoje: dadosCalculados?.saidasHoje ?? 0,
    // Retorna a série já filtrada
    caixaPrevistoGeral,
    // Mantém o estado de carregamento e os controles de filtro
    carregando,
    filtro,
    setFiltro,
    mesFiltro,
    setMesFiltro,
    getTituloPrevisao: () => {
      if (filtro === 'tudo') return 'Histórico e Futuro'
      if (filtro === '30dias') {
        const hoje = getDataAtualBrasil()
        const fim30Dias = calcularDataNDias(hoje, 29)
        return `Próximos 30 Dias: ${formatarDataParaExibicao(hoje)} a ${formatarDataParaExibicao(fim30Dias)}`
      }
      if (filtro === 'mes' && mesFiltro) {
        const [ano, mes] = mesFiltro.split('-')
        return `Mês: ${mes}/${ano}`
      }
      return 'Período'
    },
  }
}
