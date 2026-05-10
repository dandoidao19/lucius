// src/hooks/useTransacoesLoja.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TransacaoLoja } from '@/types';
import { subDays, format } from 'date-fns';

const fetchTransacoesLoja = async (): Promise<TransacaoLoja[]> => {
  const pageSize = 1000;
  let offset = 0;
  const allTransacoes: TransacaoLoja[] = [];

  // Limita a busca inicial aos últimos 120 dias para performance
  const dataLimite = format(subDays(new Date(), 120), 'yyyy-MM-dd');

  while (true) {
    const { data, error } = await supabase
      .from('transacoes_loja')
      .select('*')
      .gte('data', dataLimite)
      .order('data', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Erro ao buscar transações da loja:', error);
      throw new Error('Não foi possível buscar as transações da loja');
    }

    if (!data || data.length === 0) {
      break;
    }

    allTransacoes.push(...data);

    if (data.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return allTransacoes;
};

export function useTransacoesLoja() {
  return useQuery<TransacaoLoja[]>({
    queryKey: ['transacoes_loja'],
    queryFn: fetchTransacoesLoja,
  });
}
