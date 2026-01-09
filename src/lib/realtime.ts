// lib/realtime.ts
import { supabase } from './supabase'
import { QueryClient } from '@tanstack/react-query'

export function subscribeToChanges(queryClient: QueryClient) {
  const subscription = supabase
    .channel('schema-db-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'transacoes_loja',
      },
      (payload) => {
        console.log('Change received in transacoes_loja!', payload)
        queryClient.invalidateQueries({ queryKey: ['caixaUniversal'] })
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'lancamentos_financeiros',
      },
      (payload) => {
        console.log('Change received in lancamentos_financeiros!', payload)
        queryClient.invalidateQueries({ queryKey: ['caixaUniversal'] })
      },
    )
    .subscribe()

  return subscription
}
