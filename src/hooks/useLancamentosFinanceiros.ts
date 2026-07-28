// src/hooks/useLancamentosFinanceiros.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { LancamentoFinanceiro } from '@/types'
const PAGE_SIZE = 1000
const MAX_PAGES = 250 // guardrail alto

const fetchLancamentosFinanceiros = async (): Promise<LancamentoFinanceiro[]> => {
  const allLancamentos: LancamentoFinanceiro[] = []
  let lastId: string | null = null

  for (let page = 0; page < MAX_PAGES; page++) {
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
      console.error('Erro ao buscar lançamentos financeiros:', error)
      throw new Error('Não foi possível buscar os lançamentos financeiros')
    }

    if (!data || data.length === 0) break

    allLancamentos.push(...(data as unknown as LancamentoFinanceiro[]))

    const lastRow = data[data.length - 1] as { id: string }
    lastId = lastRow.id

    if (data.length < PAGE_SIZE) break
  }

  return allLancamentos
}

export function useLancamentosFinanceiros() {
  return useQuery<LancamentoFinanceiro[]>({
    queryKey: ['lancamentos_financeiros'],
    queryFn: fetchLancamentosFinanceiros,
  })
}
