// src/hooks/useCentrosDeCusto.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { CentroCusto } from '@/types';

const fetchCentrosDeCusto = async (): Promise<CentroCusto[]> => {
  const { data, error } = await supabase
    .from('centros_de_custo')
    .select('*')
    .order('nome');

  if (error) {
    console.error('Erro ao buscar centros de custo:', error);
    throw new Error('Não foi possível buscar os centros de custo');
  }

  return data || [];
};

export function useCentrosDeCusto() {
  return useQuery<CentroCusto[]>({
    queryKey: ['centros_de_custo'],
    queryFn: fetchCentrosDeCusto,
  });
}
