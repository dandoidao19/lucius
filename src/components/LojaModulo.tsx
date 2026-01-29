'use client'

import { useState } from 'react'
import LojaPaginaFinanceiro from './LojaPaginaFinanceiro'
import LojaPaginaEstoque from './LojaPaginaEstoque'
import LojaPaginaTransacoes from './LojaPaginaTransacoes'

type AbaLoja = 'financeiro' | 'transacoes' | 'estoque'

export default function LojaModulo() {
  const [abaAtiva, setAbaAtiva] = useState<AbaLoja>('financeiro')

  const abas: { id: AbaLoja; titulo: string; icone: string; corAtiva: string }[] = [
    { id: 'financeiro', titulo: 'Financeiro', icone: '💳', corAtiva: 'bg-purple-600 text-white shadow-md' },
    { id: 'transacoes', titulo: 'Transações', icone: '🔄', corAtiva: 'bg-pink-700 text-white shadow-md' },
    { id: 'estoque', titulo: 'Estoque', icone: '📦', corAtiva: 'bg-red-700 text-white shadow-md' },
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
      {/* Menu Horizontal Compacto */}
      <div className="bg-white rounded shadow-sm overflow-hidden border border-gray-200 p-0.5">
        <nav className="flex flex-wrap gap-0.5">
          {abas.map((aba) => (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              className={`flex-1 min-w-max px-4 py-1 text-sm font-semibold transition-all rounded flex items-center justify-center ${
                abaAtiva === aba.id
                  ? aba.corAtiva
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-transparent'
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
