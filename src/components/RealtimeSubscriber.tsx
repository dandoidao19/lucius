// src/components/RealtimeSubscriber.tsx
'use client'

import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates'

// Este componente não renderiza nada na UI.
// Seu único propósito é ativar o hook de atualizações em tempo real
// no escopo global da aplicação.
export function RealtimeSubscriber() {
  useRealtimeUpdates()
  return null
}
