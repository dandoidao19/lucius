// context/DadosFinanceirosContext.tsx
'use client'

import { createContext, useContext, ReactNode, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCentrosDeCusto } from '@/hooks/useCentrosDeCusto'
import { useLancamentosFinanceiros } from '@/hooks/useLancamentosFinanceiros'
import { useTransacoesLoja } from '@/hooks/useTransacoesLoja'

import { CentroCusto, LancamentoFinanceiro } from '@/types'

// A interface Lancamento foi renomeada para LancamentoFinanceiro em @/types
// Os tipos locais podem ser removidos.

interface DadosCache {
  centrosCustoCasa: CentroCusto[]
  centrosCustoLoja: CentroCusto[]
  lancamentosCasa: LancamentoFinanceiro[]
  lancamentosLoja: LancamentoFinanceiro[]
  todosLancamentosCasa: LancamentoFinanceiro[]
  todosLancamentosLoja: LancamentoFinanceiro[]
  caixaRealCasa: number
  caixaRealLoja: number
  ultimaAtualizacao: number
}

interface DadosFinanceirosContextType {
  dados: DadosCache
  carregando: boolean
  recarregarDados: () => void
}

const DadosFinanceirosContext = createContext<DadosFinanceirosContextType | undefined>(undefined)

export function DadosFinanceirosProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  // 1. Buscar dados usando os novos hooks
  const { data: todosCentrosDeCusto = [], isLoading: carregandoCentros, dataUpdatedAt: centrosAtualizadoEm } = useCentrosDeCusto();
  const { data: todosLancamentos = [], isLoading: carregandoLancamentos, dataUpdatedAt: lancamentosAtualizadoEm } = useLancamentosFinanceiros();
  const { data: todasTransacoesLoja = [], isLoading: carregandoTransacoes, dataUpdatedAt: transacoesAtualizadoEm } = useTransacoesLoja();

  const carregando = carregandoCentros || carregandoLancamentos || carregandoTransacoes;

  // 2. Processar e memorizar os dados derivados
  const dados = useMemo<DadosCache>(() => {
    // Filtrar Centros de Custo
    const centrosCustoCasa = todosCentrosDeCusto.filter(c => c.contexto === 'casa')
    const centrosCustoLoja = todosCentrosDeCusto.filter(c => c.contexto === 'loja')
    const idsCentrosCasa = new Set(centrosCustoCasa.map(c => c.id))
    const idsCentrosLoja = new Set(centrosCustoLoja.map(c => c.id))

    // Filtrar Lançamentos
    const lancamentosCasa = todosLancamentos.filter(l => idsCentrosCasa.has(l.centro_custo_id))
    const lancamentosLoja = todosLancamentos.filter(l => idsCentrosLoja.has(l.centro_custo_id))

    // Calcular Caixa Real (lógica migrada da função original)
    const caixaRealLoja = todasTransacoesLoja
      .filter(t => t.status_pagamento === 'pago')
      .reduce((acc, t) => acc + (t.tipo === 'entrada' ? (t.valor_pago ?? t.total) : -(t.valor_pago ?? t.total)), 0)

    const caixaRealCasa = todosLancamentos
      .filter(l => l.status === 'realizado' && l.caixa_id === '69bebc06-f495-4fed-b0b1-beafb50c017b') // ID Caixa Casa
      .reduce((acc, l) => acc + (l.tipo === 'entrada' ? l.valor : -l.valor), 0)

    return {
      centrosCustoCasa,
      centrosCustoLoja,
      lancamentosCasa,
      lancamentosLoja,
      todosLancamentosCasa: lancamentosCasa, // Adicionado para compatibilidade
      todosLancamentosLoja: lancamentosLoja, // Adicionado para compatibilidade
      caixaRealCasa,
      caixaRealLoja,
      ultimaAtualizacao: Math.max(centrosAtualizadoEm, lancamentosAtualizadoEm, transacoesAtualizadoEm),
    }
  }, [todosCentrosDeCusto, todosLancamentos, todasTransacoesLoja, centrosAtualizadoEm, lancamentosAtualizadoEm, transacoesAtualizadoEm])

  // 3. Função para invalidar queries e forçar recarregamento
  const recarregarDados = useCallback(() => {
    console.log('🔄 Invalidando queries e recarregando dados...')
    queryClient.invalidateQueries({ queryKey: ['centros_de_custo'] })
    queryClient.invalidateQueries({ queryKey: ['lancamentos_financeiros'] })
    queryClient.invalidateQueries({ queryKey: ['transacoes_loja'] })
  }, [queryClient])

  return (
    <DadosFinanceirosContext.Provider value={{ dados, carregando, recarregarDados }}>
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
