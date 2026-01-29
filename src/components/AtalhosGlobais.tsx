'use client'

import { useState } from 'react'
import ModalTransacaoUnificada from './ModalTransacaoUnificada'
import ModalLancamentoCasa from './ModalLancamentoCasa'
import ModalFinanceiroAvulso from './ModalFinanceiroAvulso'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'

export default function AtalhosGlobais() {
  const [modalLojaAberto, setModalLojaAberto] = useState(false)
  const [modalCasaAberto, setModalCasaAberto] = useState(false)
  const [modalFinanceiroAberto, setModalFinanceiroAberto] = useState(false)
  const { recarregarDados } = useDadosFinanceiros()

  return (
    <>
      {/* Botões Flutuantes (Balões) - Agora à Esquerda e Centralizados Verticalmente */}
      <div className="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-[40]">
        {/* Lançamento Casa */}
        <div className="relative group flex items-center">
          <button
            onClick={() => setModalCasaAberto(true)}
            className="w-14 h-14 bg-orange-600 text-white rounded-full shadow-xl hover:bg-orange-700 transition-all flex items-center justify-center"
          >
            <span className="text-2xl">🏠</span>
          </button>
          <span className="absolute left-16 bg-gray-900 text-white text-sm font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-2xl">
            Lançamento Casa
          </span>
        </div>

        {/* Nova Transação Loja */}
        <div className="relative group flex items-center">
          <button
            onClick={() => setModalLojaAberto(true)}
            className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center"
          >
            <span className="text-2xl">🛒</span>
          </button>
          <span className="absolute left-16 bg-gray-900 text-white text-sm font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-2xl">
            Transação Loja
          </span>
        </div>

        {/* Financeiro Avulso Loja */}
        <div className="relative group flex items-center">
          <button
            onClick={() => setModalFinanceiroAberto(true)}
            className="w-14 h-14 bg-green-600 text-white rounded-full shadow-xl hover:bg-green-700 transition-all flex items-center justify-center"
          >
            <span className="text-2xl">💵</span>
          </button>
          <span className="absolute left-16 bg-gray-900 text-white text-sm font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-2xl">
            Financeiro Avulso
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
        onSucesso={() => recarregarDados()}
      />

      <ModalFinanceiroAvulso
        aberto={modalFinanceiroAberto}
        onClose={() => setModalFinanceiroAberto(false)}
        onSucesso={() => recarregarDados()}
      />
    </>
  )
}
