// src/hooks/useLancamentosParaCaixa.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { LancamentoFinanceiro } from '@/types'

const PAGE_SIZE = 1000
const MAX_PAGES = 200 // guardrail alto; para o Caixa queremos “tudo”, mas não infinito

const fetchLancamentosParaCaixa = async (): Promise<LancamentoFinanceiro[]> => {
  const allLancamentos: LancamentoFinanceiro[] = []
  let lastId: string | null = null
  let pages = 0

  for (let page = 0; page < MAX_PAGES; page++) {
    pages = page

    let query = supabase
      .from('lancamentos_financeiros')
      .select(
        `
        *,
        centros_de_custo(nome)
      `
      )
      .order('id', { ascending: false })
      .limit(PAGE_SIZE)

    if (lastId) {
      query = query.lt('id', lastId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar lançamentos para Caixa:', error)
      throw new Error('Não foi possível buscar os lançamentos para o Caixa')
    }

    if (!data || data.length === 0) break

    allLancamentos.push(...(data as unknown as LancamentoFinanceiro[]))

    const lastRow = data[data.length - 1] as { id: string }
    lastId = lastRow.id

    if (data.length < PAGE_SIZE) break
  }

  // Diagnóstico para validar se o Caixa está recebendo dados
  console.log('[DEBUG] useLancamentosParaCaixa fetched:', {
    total: allLancamentos.length,
    pagesTried: pages,
    hasFirst: allLancamentos.length > 0,
    sample: allLancamentos.slice(0, 3).map(l => ({
      id: (l as any).id,
      status: l.status,
      valor: (l as any).valor,
      data_prevista: (l as any).data_prevista,
      data_lancamento: (l as any).data_lancamento,
      tipo: l.tipo,
    })),
  })

  return allLancamentos
}

export function useLancamentosParaCaixa() {
  return useQuery<LancamentoFinanceiro[]>({
    queryKey: ['lancamentos_financeiros_para_caixa'],
    queryFn: fetchLancamentosParaCaixa,
  })
}
