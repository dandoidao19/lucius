'use client'

import { useState, useEffect } from 'react'
import LojaPaginaFinanceiro from './LojaPaginaFinanceiro'
import LojaPaginaEstoque from './LojaPaginaEstoque'
import LojaPaginaTransacoes from './LojaPaginaTransacoes'
import LojaPaginaDashboard from './LojaPaginaDashboard'

type AbaLoja = 'financeiro' | 'transacoes' | 'dashboard' | 'estoque'

export default function LojaModulo() {
  const [abaAtiva, setAbaAtiva] = useState<AbaLoja>('financeiro')

  // ✅ PERSISTÊNCIA DA ABA ATIVA
  useEffect(() => {
    const salva = localStorage.getItem('lucius_aba_ativa_loja')
    if (salva && (salva === 'financeiro' || salva === 'transacoes' || salva === 'dashboard' || salva === 'estoque')) {
      setAbaAtiva(salva as AbaLoja)
    }
  }, [])

  const trocarAba = (novaAba: AbaLoja) => {
    setAbaAtiva(novaAba)
    localStorage.setItem('lucius_aba_ativa_loja', novaAba)
  }

  const abas: { id: AbaLoja; titulo: string; icone: string; corAtiva: string }[] = [
    { id: 'financeiro', titulo: 'Financeiro', icone: '💳', corAtiva: 'bg-purple-600 text-white shadow-md' },
    { id: 'transacoes', titulo: 'Transações', icone: '🔄', corAtiva: 'bg-pink-700 text-white shadow-md' },
    { id: 'dashboard', titulo: 'Dashboard', icone: '📊', corAtiva: 'bg-blue-600 text-white shadow-md' },
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
      case 'dashboard':
        return <LojaPaginaDashboard />
      default:
        return null
    }
  }

  return (
    <div className="space-y-1">
      {/* Menu Horizontal Compacto */}
      <div className="bg-white rounded shadow-sm overflow-hidden border border-gray-200 p-0.5">
        <nav className="flex flex-nowrap overflow-x-auto gap-0.5 custom-scrollbar">
          {abas.map((aba) => (
            <button
              key={aba.id}
              onClick={() => trocarAba(aba.id)}
              className={`flex-1 min-w-max px-4 py-2 sm:py-1 text-xs sm:text-sm font-semibold transition-all rounded flex items-center justify-center whitespace-nowrap ${
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
