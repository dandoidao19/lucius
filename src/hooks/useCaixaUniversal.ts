// hooks/useCaixaUniversal.ts - VERSÃO MULTI-MÓDULO
import { useState, useMemo, useCallback } from 'react'
import { useCaixaPrevisto } from './useCaixaPrevisto'
import { getDataAtualBrasil, formatarDataParaExibicao } from '@/lib/dateUtils'

type Filtro = '30dias' | 'mes' | 'tudo'
type Modulo = 'loja' | 'casa' | 'geral'

export function useCaixaUniversal(modulo: Modulo = 'geral') {
  const [filtro, setFiltro] = useState<Filtro>('30dias')
  const [mesFiltro, setMesFiltro] = useState(() => {
    const hoje = new Date()
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  })

  // 1. Consumir os dados segmentados do hook de previsão.
  const { data: dadosCalculados, isLoading: carregando } = useCaixaPrevisto()

  const calcularDataNDias = useCallback((dataBase: string, dias: number) => {
    const data = new Date(`${dataBase}T12:00:00`)
    data.setDate(data.getDate() + dias)
    return data.toISOString().split('T')[0]
  }, [])

  // 2. Selecionar os dados específicos do módulo solicitado
  const dadosModulo = useMemo(() => {
    if (!dadosCalculados) return null
    if (modulo === 'loja') return dadosCalculados.loja
    if (modulo === 'casa') return dadosCalculados.casa
    return dadosCalculados.geral
  }, [dadosCalculados, modulo])

  // 3. Aplicar filtros sobre a série de dados do módulo
  const caixaPrevistoFiltrado = useMemo(() => {
    const series = dadosModulo?.series
    if (!series) {
      return []
    }

    const hoje = getDataAtualBrasil()

    switch (filtro) {
      case '30dias':
        const dataLimite = calcularDataNDias(hoje, 29)
        return series.filter(dia => dia.data >= hoje && dia.data <= dataLimite)

      case 'mes':
        if (mesFiltro) {
          return series.filter(dia => dia.data.startsWith(mesFiltro))
        }
        return []

      case 'tudo':
        return series.filter(dia => dia.data >= hoje)

      default:
        return []
    }
  }, [dadosModulo, filtro, mesFiltro, calcularDataNDias])

  return {
    // Totais Reais (Independente do módulo selecionado para a série prevista)
    caixaRealGeral: dadosCalculados?.caixaRealGeral ?? 0,
    caixaRealLoja: dadosCalculados?.caixaRealLoja ?? 0,
    caixaRealCasa: dadosCalculados?.caixaRealCasa ?? 0,

    // Dados específicos do módulo para a previsão
    entradasHoje: dadosModulo?.entradasHoje ?? 0,
    saidasHoje: dadosModulo?.saidasHoje ?? 0,
    caixaPrevistoGeral: caixaPrevistoFiltrado, // Mantido o nome para compatibilidade com componentes existentes

    // Controles e estado
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
