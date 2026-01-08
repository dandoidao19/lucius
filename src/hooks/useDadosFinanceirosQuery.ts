// src/hooks/useDadosFinanceirosQuery.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Lancamento } from '@/types'

// Define types locally for now
interface CentroCusto {
  id: string;
  nome: string;
  contexto: string;
  tipo: string;
  categoria: string;
  recorrencia: string;
}

interface TransacaoLoja {
    tipo: 'entrada' | 'saida';
    total: number;
    valor_pago: number | null;
}

// 1. Hook para buscar centros de custo
const buscarCentrosCusto = async (contexto: 'casa' | 'loja'): Promise<CentroCusto[]> => {
  const { data, error } = await supabase
    .from('centros_de_custo')
    .select('*')
    .eq('contexto', contexto)
    .order('nome')

  if (error) {
    console.error(`❌ Erro ao carregar centros de custo ${contexto}:`, error)
    throw new Error(`Erro ao buscar centros de custo ${contexto}`)
  }
  return data || []
}

export const useCentrosDeCusto = (contexto: 'casa' | 'loja') => {
  return useQuery({
    queryKey: ['centrosDeCusto', contexto],
    queryFn: () => buscarCentrosCusto(contexto),
  })
}

// 2. Hook para buscar lançamentos
const buscarLancamentos = async (contexto: 'casa' | 'loja'): Promise<Lancamento[]> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data: centros, error: errorCentros } = await supabase
        .from('centros_de_custo')
        .select('id')
        .eq('contexto', contexto)

      if (errorCentros) {
        console.error(`❌ Erro ao buscar centros de custo ${contexto}:`, errorCentros)
      }

      const centroIds = centros ? centros.map(c => c.id) : []

      const LIMITE_POR_PAGINA = 1000
      const LIMITE_TOTAL = 3000
      let todosLancamentos: Lancamento[] = []
      let pagina = 0
      let temMaisRegistros = true

      while (temMaisRegistros && todosLancamentos.length < LIMITE_TOTAL) {
        const inicio = pagina * LIMITE_POR_PAGINA

        let query = supabase
          .from('lancamentos_financeiros')
          .select(`
            *,
            centros_de_custo(nome)
          `)

        if (centroIds.length > 0) {
          query = query.in('centro_custo_id', centroIds)
        }

        query = query
          .order('data_prevista', { ascending: false })
          .range(inicio, inicio + LIMITE_POR_PAGINA - 1)

        const { data, error } = await query

        if (error) {
          console.error(`❌ Erro ao carregar página ${pagina + 1} de lançamentos ${contexto}:`, error)
          break
        }

        if (data && data.length > 0) {
          todosLancamentos = [...todosLancamentos, ...data]
          pagina++

          if (data.length < LIMITE_POR_PAGINA) {
            temMaisRegistros = false
          }
        } else {
          temMaisRegistros = false
        }
      }

      return todosLancamentos

    } catch (error) {
      console.error(`❌ Erro ao buscar lançamentos ${contexto}:`, error)
      return []
    }
}

export const useLancamentos = (contexto: 'casa' | 'loja') => {
    return useQuery({
        queryKey: ['lancamentos', contexto],
        queryFn: () => buscarLancamentos(contexto),
    })
}


// 3. Hook para calcular o caixa real
const calcularCaixaReal = async (contexto: 'casa' | 'loja'): Promise<number> => {
    try {
      if (contexto === 'loja') {
        const { data: transacoes, error } = await supabase
          .from('transacoes_loja')
          .select('tipo, total, valor_pago')
          .eq('status_pagamento', 'pago')

        if (error) {
          console.error(`❌ Erro ao buscar transações loja:`, error)
          return 0
        }

        let caixa = 0
        if (transacoes) {
          transacoes.forEach((trans: TransacaoLoja) => {
            const valor = trans.valor_pago !== null ? trans.valor_pago : trans.total
            if (trans.tipo === 'entrada') {
              caixa += valor
            } else {
              caixa -= valor
            }
          })
        }
        return caixa

      } else {
        const { data: lancamentos, error } = await supabase
          .from('lancamentos_financeiros')
          .select('valor, tipo, caixa_id')
          .eq('status', 'realizado')
          .eq('caixa_id', '69bebc06-f495-4fed-b0b1-beafb50c017b') // ID do caixa casa

        if (error) {
          console.error(`❌ Erro ao buscar lançamentos casa:`, error)
          return 0
        }

        let caixa = 0
        if (lancamentos && lancamentos.length > 0) {
          lancamentos.forEach((lanc: Pick<Lancamento, 'valor' | 'tipo'>) => {
            if (lanc.tipo === 'entrada') {
              caixa += lanc.valor
            } else {
              caixa -= lanc.valor
            }
          })
        }
        return caixa
      }

    } catch (error) {
      console.error(`❌ Erro ao calcular caixa real ${contexto}:`, error)
      return 0
    }
}

export const useCaixaReal = (contexto: 'casa' | 'loja') => {
    return useQuery({
        queryKey: ['caixaReal', contexto],
        queryFn: () => calcularCaixaReal(contexto),
    })
}
