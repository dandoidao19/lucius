// src/hooks/useLancamentosFinanceiros.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { LancamentoFinanceiro } from '@/types';
import { subDays, format } from 'date-fns';

const fetchLancamentosFinanceiros = async (): Promise<LancamentoFinanceiro[]> => {
  const pageSize = 1000;
  let offset = 0;
  const allLancamentos: LancamentoFinanceiro[] = [];

  // Limita a busca inicial aos últimos 120 dias para performance
  const dataLimite = format(subDays(new Date(), 120), 'yyyy-MM-dd');

  while (true) {
    const { data, error } = await supabase
      .from('lancamentos_financeiros')
      .select(`
        *,
        centros_de_custo(nome)
      `)
      .gte('data_prevista', dataLimite)
      .order('data_prevista', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Erro ao buscar lançamentos financeiros:', error);
      throw new Error('Não foi possível buscar os lançamentos financeiros');
    }

    if (!data || data.length === 0) {
      break;
    }

    // Cast seguro para LancamentoFinanceiro[] considerando que centros_de_custo(nome) está presente
    allLancamentos.push(...(data as unknown as LancamentoFinanceiro[]));

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
