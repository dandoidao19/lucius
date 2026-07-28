'use client'

import { useState, useLayoutEffect } from 'react'
import { Home } from 'lucide-react'
import ModalLancamentoCasa from './ModalLancamentoCasa'
import { useFormDraft } from '@/context/FormDraftContext'

interface AtalhosGlobaisProps {
  inline?: boolean
}

export default function AtalhosGlobais({ inline }: AtalhosGlobaisProps) {
  const [modalCasaAberto, setModalCasaAberto] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { clearDraft } = useFormDraft()

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  if (!mounted) return null

  const button = (
    <button
      type="button"
      onClick={() => {
        clearDraft('casa')
        setModalCasaAberto(true)
      }}
      className={
        inline
          ? 'inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-600 text-white shadow-sm hover:bg-blue-700 transition-all text-[11px] font-semibold relative z-20'
          : 'w-11 h-11 bg-blue-600 text-white rounded-full shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center relative z-20'
      }
      aria-label="Novo lançamento"
    >
      <Home size={14} />
      {inline ? 'Novo lançamento' : null}
    </button>
  )

  return (
    <>
      {inline ? button : null}
      <ModalLancamentoCasa aberto={modalCasaAberto} onClose={() => setModalCasaAberto(false)} />
    </>
  )
}
