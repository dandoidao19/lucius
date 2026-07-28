// context/DadosFinanceirosContext.tsx
'use client'

import { createContext, useContext, ReactNode, useMemo, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCentrosDeCusto } from '@/hooks/useCentrosDeCusto'
import { useLancamentosFinanceiros } from '@/hooks/useLancamentosFinanceiros'

// Tipos unificados para servir o contexto e os módulos consumidores (como CasaModulo)
export interface CentroCusto {
  id: string;
  nome: string;
  contexto: 'casa';
  tipo?: string;
  categoria?: string;
  recorrencia?: string;
}

export interface LancamentoFinanceiro {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: 'entrada' | 'saida';
  status: 'previsto' | 'realizado';
  centro_custo_id: string;
  caixa_id?: string;
  data_prevista?: string;
  data_lancamento?: string;
  centros_de_custo?: { nome: string };
  parcelamento?: {
    atual?: number;
    total?: number;
  } | null;
  recorrencia?: {
    tipo?: string;
    qtd?: number;
    prazo?: string;
    dia?: string;
  } | null;
  origem?: string;
}

interface DadosCache {
  centrosCustoCasa: CentroCusto[]
  lancamentosCasa: LancamentoFinanceiro[]
  todosLancamentosCasa: LancamentoFinanceiro[]
  caixaRealCasa: number
  ultimaAtualizacao: number
}

interface DadosFinanceirosContextType {
  dados: DadosCache
  carregando: boolean
  recarregarDados: () => void
  versaoRefresh: number
  triggerRefresh: () => void
}

const DadosFinanceirosContext = createContext<DadosFinanceirosContextType | undefined>(undefined)

export function DadosFinanceirosProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [versaoRefresh, setVersaoRefresh] = useState(0)

  // 1. Buscar dados usando os novos hooks
  const { data: todosCentrosDeCusto = [], isLoading: carregandoCentros, dataUpdatedAt: centrosAtualizadoEm } = useCentrosDeCusto();
  const { data: todosLancamentos = [], isLoading: carregandoLancamentos, dataUpdatedAt: lancamentosAtualizadoEm } = useLancamentosFinanceiros();

  const carregando = carregandoCentros || carregandoLancamentos;

  // 2. Processar e memorizar os dados derivados
  const dados = useMemo<DadosCache>(() => {
    // Filtrar Centros de Custo
    const centrosCustoCasa = todosCentrosDeCusto.filter(c => c.contexto === 'casa')
    const idsCentrosCasa = new Set(centrosCustoCasa.map(c => c.id))

    // Filtrar Lançamentos
    const lancamentosCasa = todosLancamentos.filter(l => idsCentrosCasa.has(l.centro_custo_id))

    // Calcular Caixa Real (Casa)
    const CAIXA_CASA_ID = '69bebc06-f495-4fed-b0b1-beafb50c017b'

    const normalizarStatus = (v: unknown) => String(v ?? '').trim().toLowerCase()
    const normalizarTipo = (v: unknown) => String(v ?? '').trim().toLowerCase()
    const normalizarCaixaId = (v: unknown) => String(v ?? '').trim()

    // Filtrar apenas o que é 'realizado' para o Caixa Real
    // Garantir que trabalhamos apenas com lançamentos do contexto CASA
    const realizadosCasa = lancamentosCasa.filter(
      l => normalizarStatus(l.status) === 'realizado'
    )

    const filtroComCaixaId = realizadosCasa.filter(
      l => normalizarCaixaId(l.caixa_id) === CAIXA_CASA_ID
    )

    const somaRealizado = (lista: LancamentoFinanceiro[]) =>
      lista.reduce((acc, l) => {
        const tipo = normalizarTipo(l.tipo)
        return acc + (tipo === 'entrada' ? l.valor : -l.valor)
      }, 0)

    // Se houver lançamentos com o ID do caixa específico, usa eles. 
    // Caso contrário, usa todos os realizados que pertencem aos centros de custo da casa.
    const caixaRealCasa = filtroComCaixaId.length > 0 
      ? somaRealizado(filtroComCaixaId) 
      : somaRealizado(realizadosCasa)

    return {
      centrosCustoCasa,
      lancamentosCasa,
      todosLancamentosCasa: lancamentosCasa, // Adicionado para compatibilidade
      caixaRealCasa,
      ultimaAtualizacao: Math.max(centrosAtualizadoEm, lancamentosAtualizadoEm),
    }
  }, [todosCentrosDeCusto, todosLancamentos, centrosAtualizadoEm, lancamentosAtualizadoEm])

  // 3. Função para invalidar queries e forçar recarregamento
  const recarregarDados = useCallback(() => {
    console.log('🔄 Invalidando queries e recarregando dados...')
    queryClient.invalidateQueries({ queryKey: ['centros_de_custo'] })
    queryClient.invalidateQueries({ queryKey: ['lancamentos_financeiros'] })
    queryClient.invalidateQueries({ queryKey: ['lancamentos_financeiros_para_caixa'] })
    queryClient.invalidateQueries({ queryKey: ['caixa_previsto_calculado_casa'] })
  }, [queryClient])

  const triggerRefresh = useCallback(() => {
    console.log('⚡ triggerRefresh() chamado. Nova versão:', versaoRefresh + 1)
    setVersaoRefresh(v => v + 1)
    recarregarDados()
  }, [recarregarDados, versaoRefresh])

  return (
    <DadosFinanceirosContext.Provider value={{ dados, carregando, recarregarDados, versaoRefresh, triggerRefresh }}>
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
