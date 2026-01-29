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
    <div className="space-y-1">
      {/* Menu Horizontal */}
      <div className="bg-white rounded shadow-sm overflow-hidden border-t-4 border-purple-500">
        <nav className="flex flex-wrap gap-0">
          {abas.map((aba) => (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              className={`flex-1 min-w-max px-4 py-1 text-xs font-bold transition-all border-b-2 ${
                abaAtiva === aba.id
                  ? 'bg-purple-50 text-purple-600 border-purple-500'
                  : 'bg-white text-gray-700 border-transparent hover:bg-purple-50'
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
