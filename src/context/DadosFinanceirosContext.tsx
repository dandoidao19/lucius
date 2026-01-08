// context/DadosFinanceirosContext.tsx
'use client'

import { createContext, useContext, ReactNode, useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCentrosDeCusto, useLancamentos, useCaixaReal } from '@/hooks/useDadosFinanceirosQuery'
import { CentroCusto, Lancamento } from '@/types'

interface DadosCache {
  centrosCustoCasa: CentroCusto[]
  centrosCustoLoja: CentroCusto[]
  lancamentosCasa: Lancamento[]
  lancamentosLoja: Lancamento[]
  caixaRealCasa: number
  caixaRealLoja: number
}

interface DadosFinanceirosContextType {
  dados: DadosCache
  carregando: boolean
  recarregarDados: () => Promise<void>
  recarregarLancamentos: (contexto: 'casa' | 'loja') => Promise<void>
  atualizarCaixaReal: (contexto: 'casa' | 'loja') => Promise<void>
  limparCache: () => void
}

const DadosFinanceirosContext = createContext<DadosFinanceirosContextType | undefined>(undefined)

export function DadosFinanceirosProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  // Supabase Realtime Subscription
  useEffect(() => {
    console.log('📡 Configurando assinaturas do Supabase Realtime...')

    const channel = supabase
      .channel('dados-financeiros-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lancamentos_financeiros' },
        (payload) => {
          console.log('🔄 Alteração detectada em lancamentos_financeiros:', payload)
          // Invalida os lançamentos e o caixa de ambos os contextos
          queryClient.invalidateQueries({ queryKey: ['lancamentos', 'casa'] })
          queryClient.invalidateQueries({ queryKey: ['lancamentos', 'loja'] })
          queryClient.invalidateQueries({ queryKey: ['caixaReal', 'casa'] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transacoes_loja' },
        (payload) => {
          console.log('🔄 Alteração detectada em transacoes_loja:', payload)
          // Invalida os lançamentos e o caixa da loja
          queryClient.invalidateQueries({ queryKey: ['lancamentos', 'loja'] })
          queryClient.invalidateQueries({ queryKey: ['caixaReal', 'loja'] })
        }
      )
      .subscribe()

    console.log('✅ Assinaturas do Supabase Realtime ativas.')

    // Cleanup
    return () => {
      console.log('🧹 Removendo assinaturas do Supabase Realtime.')
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  // Utiliza os novos hooks do React Query
  const { data: centrosCustoCasa = [], isLoading: loadingCentrosCasa } = useCentrosDeCusto('casa')
  const { data: centrosCustoLoja = [], isLoading: loadingCentrosLoja } = useCentrosDeCusto('loja')
  const { data: lancamentosCasa = [], isLoading: loadingLancamentosCasa } = useLancamentos('casa')
  const { data: lancamentosLoja = [], isLoading: loadingLancamentosLoja } = useLancamentos('loja')
  const { data: caixaRealCasa = 0, isLoading: loadingCaixaCasa } = useCaixaReal('casa')
  const { data: caixaRealLoja = 0, isLoading: loadingCaixaLoja } = useCaixaReal('loja')

  const carregando =
    loadingCentrosCasa ||
    loadingCentrosLoja ||
    loadingLancamentosCasa ||
    loadingLancamentosLoja ||
    loadingCaixaCasa ||
    loadingCaixaLoja;

  const dados: DadosCache = {
    centrosCustoCasa: centrosCustoCasa as CentroCusto[],
    centrosCustoLoja: centrosCustoLoja as CentroCusto[],
    lancamentosCasa,
    lancamentosLoja,
    caixaRealCasa,
    caixaRealLoja,
  }

  // Funções de controle que invalidam o cache do React Query
  const recarregarDados = useCallback(async () => {
    console.log('🔄 Invalidando todo o cache de dados financeiros...')
    await queryClient.invalidateQueries()
    console.log('✅ Cache invalidado.')
  }, [queryClient])

  const recarregarLancamentos = useCallback(async (contexto: 'casa' | 'loja') => {
    console.log(`🔄 Invalidando cache de lançamentos ${contexto}...`)
    await queryClient.invalidateQueries({ queryKey: ['lancamentos', contexto] })
    await queryClient.invalidateQueries({ queryKey: ['caixaReal', contexto] })
    console.log(`✅ Cache de lançamentos ${contexto} invalidado.`)
  }, [queryClient])

  const atualizarCaixaReal = useCallback(async (contexto: 'casa' | 'loja') => {
    console.log(`💰 Invalidando cache do caixa real ${contexto}...`)
    await queryClient.invalidateQueries({ queryKey: ['caixaReal', contexto] })
    console.log(`✅ Cache do caixa real ${contexto} invalidado.`)
  }, [queryClient])

  const limparCache = useCallback(() => {
    console.log('🧹 Limpando todo o cache do React Query...')
    queryClient.clear()
    console.log('✅ Cache limpo.')
  }, [queryClient])


  return (
    <DadosFinanceirosContext.Provider
      value={{
        dados,
        carregando,
        recarregarDados,
        recarregarLancamentos,
        atualizarCaixaReal,
        limparCache,
      }}
    >
      {children}
    </DadosFinanceirosContext.Provider>
  )
}

export function useDadosFinanceiros() {
  const context = useContext(DadosFinanceirosContext)
  if (context === undefined) {
    throw new Error('useDadosFinanceiros deve ser usado dentro de DadosFinanceirosProvider')
  }
  return context
}
