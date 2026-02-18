'use client'

import { useState, useEffect } from 'react'
import { Home, ShoppingBag, Receipt, Handshake } from 'lucide-react'
import ModalTransacaoUnificada from './ModalTransacaoUnificada'
import ModalLancamentoCasa from './ModalLancamentoCasa'
import ModalFinanceiroAvulso from './ModalFinanceiroAvulso'
import ModalVendaCasada from './ModalVendaCasada'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'
import { useFormDraft } from '@/context/FormDraftContext'

export default function AtalhosGlobais() {
  const [modalLojaAberto, setModalLojaAberto] = useState(false)
  const [modalCasaAberto, setModalCasaAberto] = useState(false)
  const [modalFinanceiroAberto, setModalFinanceiroAberto] = useState(false)
  const [modalVendaCasadaAberto, setModalVendaCasadaAberto] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { triggerRefresh } = useDadosFinanceiros()
  const { hasDraft } = useFormDraft()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <>
      {/* Botões Flutuantes (Balões) - Agora à Esquerda e Centralizados Verticalmente */}
      <div className="fixed left-2 sm:left-3 top-1/2 -translate-y-1/2 flex flex-col gap-2.5 sm:gap-3.5 z-[40]">
        {/* Lançamento Casa */}
        <div className="relative group flex items-center">
          <button
            onClick={() => setModalCasaAberto(true)}
            className="w-9 h-9 sm:w-11 sm:h-11 bg-blue-600 text-white rounded-full shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center relative"
          >
            <Home className="w-5 h-5 sm:w-[22px] sm:h-[22px]" />
            {hasDraft('casa') && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[9px] font-bold animate-pulse">!</span>
            )}
          </button>
          <span className="absolute left-14 bg-gray-900 text-white text-xs font-semibold px-2.5 h-7 flex items-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-2xl">
            Lançamento Casa
          </span>
        </div>

        {/* Nova Transação Loja */}
        <div className="relative group flex items-center">
          <button
            onClick={() => setModalLojaAberto(true)}
            className="w-9 h-9 sm:w-11 sm:h-11 bg-pink-700 text-white rounded-full shadow-xl hover:bg-pink-800 transition-all flex items-center justify-center relative"
          >
            <ShoppingBag className="w-5 h-5 sm:w-[22px] sm:h-[22px]" />
            {hasDraft('loja') && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[9px] font-bold animate-pulse">!</span>
            )}
          </button>
          <span className="absolute left-14 bg-gray-900 text-white text-xs font-semibold px-2.5 h-7 flex items-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-2xl">
            Transação Loja
          </span>
        </div>

        {/* Financeiro Avulso Loja */}
        <div className="relative group flex items-center">
          <button
            onClick={() => setModalFinanceiroAberto(true)}
            className="w-9 h-9 sm:w-11 sm:h-11 bg-purple-600 text-white rounded-full shadow-xl hover:bg-purple-700 transition-all flex items-center justify-center relative"
          >
            <Receipt className="w-5 h-5 sm:w-[22px] sm:h-[22px]" />
            {hasDraft('financeiro') && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[9px] font-bold animate-pulse">!</span>
            )}
          </button>
          <span className="absolute left-14 bg-gray-900 text-white text-xs font-semibold px-2.5 h-7 flex items-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-2xl">
            Financeiro Avulso
          </span>
        </div>

        {/* Venda Casada */}
        <div className="relative group flex items-center">
          <button
            onClick={() => setModalVendaCasadaAberto(true)}
            className="w-9 h-9 sm:w-11 sm:h-11 bg-slate-900 text-white rounded-full shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center relative"
          >
            <Handshake className="w-5 h-5 sm:w-[22px] sm:h-[22px]" />
            {hasDraft('venda_casada') && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[9px] font-bold animate-pulse">!</span>
            )}
          </button>
          <span className="absolute left-14 bg-gray-900 text-white text-xs font-semibold px-2.5 h-7 flex items-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-2xl">
            Venda Casada
          </span>
        </div>
      </div>

      {/* Modais */}
      <ModalLancamentoCasa
        aberto={modalCasaAberto}
        onClose={() => setModalCasaAberto(false)}
      />

      <ModalTransacaoUnificada
        aberto={modalLojaAberto}
        onClose={() => setModalLojaAberto(false)}
        onSucesso={() => triggerRefresh()}
      />

      <ModalFinanceiroAvulso
        aberto={modalFinanceiroAberto}
        onClose={() => setModalFinanceiroAberto(false)}
        onSucesso={() => triggerRefresh()}
      />

      <ModalVendaCasada
        aberto={modalVendaCasadaAberto}
        onClose={() => setModalVendaCasadaAberto(false)}
        onSucesso={() => triggerRefresh()}
      />
    </>
  )
}
