'use client'

import { useState } from 'react'
import LojaPaginaFinanceiro from './LojaPaginaFinanceiro'
import LojaPaginaEstoque from './LojaPaginaEstoque'
import LojaPaginaTransacoes from './LojaPaginaTransacoes'

type AbaLoja = 'financeiro' | 'estoque' | 'transacoes'

export default function LojaModulo() {
  const [abaAtiva, setAbaAtiva] = useState<AbaLoja>('financeiro')

  const abas: { id: AbaLoja; titulo: string; icone: string }[] = [
    { id: 'financeiro', titulo: 'Financeiro', icone: '💳' },
    { id: 'transacoes', titulo: 'Transações', icone: '🔄' },
    { id: 'estoque', titulo: 'Estoque', icone: '📦' },
  ]

  const renderizarConteudo = () => {
    switch (abaAtiva) {
      case 'financeiro':
        return <LojaPaginaFinanceiro />
      case 'estoque':
        return <LojaPaginaEstoque />
      case 'transacoes':
        return <LojaPaginaTransacoes />
      default:
        return null
    }
  }

  return (
    <div className="space-y-2">
      {/* Menu Horizontal */}
      <div className="bg-white rounded shadow-sm overflow-hidden">
        <nav className="flex flex-wrap gap-0">
          {abas.map((aba) => (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              className={`flex-1 min-w-max px-4 py-2 text-sm font-semibold transition-all border-b-2 ${
                abaAtiva === aba.id
                  ? 'bg-blue-50 text-blue-600 border-blue-500'
                  : 'bg-white text-gray-700 border-transparent hover:bg-gray-50'
              }`}
            >
              <span className="mr-2">{aba.icone}</span>
              {aba.titulo}
            </button>
          ))}
        </nav>
      </div>

      {/* Conteúdo da Aba Ativa */}
      {renderizarConteudo()}
    </div>
  )
}
