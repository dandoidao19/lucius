// src/hooks/useLancamentosFinanceiros.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { LancamentoFinanceiro } from '@/types';

const fetchLancamentosFinanceiros = async (): Promise<LancamentoFinanceiro[]> => {
  const pageSize = 1000;
  let offset = 0;
  const allLancamentos: LancamentoFinanceiro[] = [];

  while (true) {
    const { data, error } = await supabase
      .from('lancamentos_financeiros')
      .select(`
        *,
        centros_de_custo(nome)
      `)
      .order('data_prevista', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Erro ao buscar lançamentos financeiros:', error);
      throw new Error('Não foi possível buscar os lançamentos financeiros');
    }

    if (!data || data.length === 0) {
      break;
    }

    allLancamentos.push(...data);

    if (data.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return allLancamentos;
};

export function useLancamentosFinanceiros() {
  return useQuery<LancamentoFinanceiro[]>({
    queryKey: ['lancamentos_financeiros'],
    queryFn: fetchLancamentosFinanceiros,
  });
}
