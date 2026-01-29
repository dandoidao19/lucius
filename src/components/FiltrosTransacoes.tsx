'use client'

import { useState } from 'react'

interface FiltrosTransacoesProps {
  filtroDataInicio: string
  setFiltroDataInicio: (v: string) => void
  filtroDataFim: string
  setFiltroDataFim: (v: string) => void
  filtroNumero: string
  setFiltroNumero: (v: string) => void
  filtroEntidade: string
  setFiltroEntidade: (v: string) => void
  filtroTipo: string
  setFiltroTipo: (v: string) => void
  filtroStatus: string
  setFiltroStatus: (v: string) => void
  onLimpar: () => void
  onGerarPDF: () => void
}

export default function FiltrosTransacoes({
  filtroDataInicio,
  setFiltroDataInicio,
  filtroDataFim,
  setFiltroDataFim,
  filtroNumero,
  setFiltroNumero,
  filtroEntidade,
  setFiltroEntidade,
  filtroTipo,
  setFiltroTipo,
  filtroStatus,
  setFiltroStatus,
  onLimpar,
  onGerarPDF
}: FiltrosTransacoesProps) {
  const [aberto, setAberto] = useState(false)

  const tipos = [
    { value: 'todos', label: 'Todos' },
    { value: 'venda', label: 'Venda' },
    { value: 'compra', label: 'Compra' },
    { value: 'pedido_venda', label: 'Pedido Venda' },
    { value: 'pedido_compra', label: 'Pedido Compra' },
    { value: 'condicional_cliente', label: 'Cond. Cliente' },
    { value: 'condicional_fornecedor', label: 'Cond. Fornecedor' },
  ]

  const statusOptions = [
    { value: 'todos', label: 'Todos' },
    { value: 'pago', label: 'Pago' },
    { value: 'pendente', label: 'Pendente' },
    { value: 'resolvido', label: 'Resolvido' },
    { value: 'cancelado', label: 'Cancelado' },
  ]

  return (
    <div className="bg-purple-600 rounded shadow-sm mb-2 border border-purple-700 overflow-hidden">
      <button
        onClick={() => setAberto(!aberto)}
        className="w-full px-3 py-2 flex items-center justify-between text-xs font-black text-white uppercase tracking-widest hover:bg-purple-700 transition-colors"
      >
        <span>🔍 Filtros de Transações</span>
        <span>{aberto ? '▲' : '▼'}</span>
      </button>

      {aberto && (
        <div className="px-3 pb-3 pt-2 bg-white border-t border-purple-200">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-0.5">Início</label>
              <input
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-0.5">Fim</label>
              <input
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-0.5">Nº Transação</label>
              <input
                type="text"
                value={filtroNumero}
                onChange={(e) => setFiltroNumero(e.target.value)}
                placeholder="Ex: 123"
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-0.5">Cliente/Fornecedor</label>
              <input
                type="text"
                value={filtroEntidade}
                onChange={(e) => setFiltroEntidade(e.target.value)}
                placeholder="Buscar..."
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-0.5">Tipo</label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
              >
                {tipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-0.5">Status</label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
              >
                {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={onLimpar} className="px-3 py-1 bg-gray-500 text-white text-xs font-bold rounded hover:bg-gray-600 transition-colors">
              🗑️ LIMPAR
            </button>
            <button onClick={onGerarPDF} className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700 transition-colors">
              📄 GERAR PDF
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
