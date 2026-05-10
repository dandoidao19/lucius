// src/hooks/useRealtimeUpdates.ts
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useRealtimeUpdates() {
  const queryClient = useQueryClient();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log('📡 Assinando atualizações em tempo real do Supabase...');

    const handleChanges = (queryKey: string) => {
      console.log(`🔔 Alteração detectada para: ${queryKey}`);

      // Debounce para evitar múltiplas invalidações simultâneas
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        console.log(`🔄 Invalidando queries após debounce: ${queryKey}`);
        queryClient.invalidateQueries({ queryKey: [queryKey] });
        debounceTimerRef.current = null;
      }, 500); // Aguarda 500ms de silêncio antes de invalidar
    };

    // Canal para 'centros_de_custo'
    const centrosChannel = supabase
      .channel('public:centros_de_custo')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'centros_de_custo' },
        () => handleChanges('centros_de_custo')
      )
      .subscribe();

    // Canal para 'lancamentos_financeiros'
    const lancamentosChannel = supabase
      .channel('public:lancamentos_financeiros')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lancamentos_financeiros' },
        () => handleChanges('lancamentos_financeiros')
      )
      .subscribe();

    // Canal para 'transacoes_loja'
    const transacoesChannel = supabase
      .channel('public:transacoes_loja')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transacoes_loja' },
        () => handleChanges('transacoes_loja')
      )
      .subscribe();

    // Função de limpeza para remover as assinaturas quando o componente for desmontado
    return () => {
      console.log('📡 Cancelando assinatura das atualizações em tempo real...');
      supabase.removeChannel(centrosChannel);
      supabase.removeChannel(lancamentosChannel);
      supabase.removeChannel(transacoesChannel);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [queryClient]);
}
