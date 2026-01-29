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
      <div className="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-[40]">
        {/* Lançamento Casa */}
        <button
          onClick={() => setModalCasaAberto(true)}
          className="w-12 h-12 bg-orange-600 text-white rounded-full shadow-lg hover:bg-orange-700 transition-all flex items-center justify-center group relative"
          title="Novo Lançamento Casa"
        >
          <span className="text-xl">🏠</span>
          <span className="absolute left-14 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Lançamento Casa</span>
        </button>

        {/* Nova Transação Loja */}
        <button
          onClick={() => setModalLojaAberto(true)}
          className="w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center group relative"
          title="Nova Transação Loja"
        >
          <span className="text-xl">🛒</span>
          <span className="absolute left-14 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Transação Loja</span>
        </button>

        {/* Financeiro Avulso Loja */}
        <button
          onClick={() => setModalFinanceiroAberto(true)}
          className="w-12 h-12 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition-all flex items-center justify-center group relative"
          title="Financeiro Avulso Loja"
        >
          <span className="text-xl">💵</span>
          <span className="absolute left-14 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Financeiro Avulso</span>
        </button>
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
