'use client'

import { useState } from 'react'
import { useCaixaGeral } from '@/hooks/useCaixaGeral'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function CaixaGeralDashboard({ inicialMinimizado = false }: { inicialMinimizado?: boolean }) {
  const {
    caixaRealGeral,
    entradasHoje,
    saidasHoje,
    caixaPrevistoGeral,
    carregando,
    filtro,
    setFiltro,
    mesFiltro,
    setMesFiltro,
    getTituloPrevisao,
  } = useCaixaGeral()

  const [minimizado, setMinimizado] = useState(inicialMinimizado)

  const formatarMoeda = (valor: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
  const formatarMoedaCompacta = (valor: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(valor)

  const handleMudarFiltro = (novoFiltro: '30dias' | 'mes' | 'tudo') => setFiltro(novoFiltro)

  return (
    <div className="flex flex-col h-full min-h-0 bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
      {/* Cabeçalho FIXO (Caixa Real + Filtros) */}
      <div className="flex-none p-1.5 border-b border-gray-200 space-y-1.5">
        <div className="flex items-center justify-between gap-1">
          <h2 className="font-semibold text-gray-800" style={{ fontSize: '12px' }}>
            💰 CAIXA GERAL
          </h2>
          <button
            onClick={() => setMinimizado(!minimizado)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-[10px] font-semibold text-gray-700 transition-colors"
            title={minimizado ? 'Expandir caixa geral' : 'Recolher caixa geral'}
          >
            {minimizado ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            {minimizado ? 'Expandir' : 'Recolher'}
          </button>
        </div>

        <div className={`rounded p-1.5 ${caixaRealGeral < 0 ? 'bg-red-500 border border-red-600' : 'bg-white border border-blue-200'}`}>
          <p className={`text-[10px] uppercase font-semibold leading-tight ${caixaRealGeral < 0 ? 'text-red-100' : 'text-gray-600'}`}>
            Caixa Real
          </p>
          <p className={`font-bold leading-tight ${caixaRealGeral < 0 ? 'text-white' : 'text-blue-600'}`} style={{ fontSize: '1.25rem' }}>
            {formatarMoeda(caixaRealGeral)}
          </p>
          <div className="mt-0.5 flex gap-2 text-[10px] leading-tight whitespace-nowrap overflow-hidden">
            <span className="text-green-600">↑ {formatarMoedaCompacta(entradasHoje)}</span>
            <span className="text-red-600">↓ {formatarMoedaCompacta(saidasHoje)}</span>
          </div>
        </div>

        {!minimizado && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleMudarFiltro('30dias')}
                disabled={carregando}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                  filtro === '30dias' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100'
                }`}
              >
                Próx. 30d
              </button>
              <button
                onClick={() => handleMudarFiltro('mes')}
                disabled={carregando}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                  filtro === 'mes' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 border border-green-300 hover:bg-green-100'
                }`}
              >
                Mês
              </button>
              <button
                onClick={() => handleMudarFiltro('tudo')}
                disabled={carregando}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                  filtro === 'tudo' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 border border-purple-300 hover:bg-purple-100'
                }`}
              >
                Tudo
              </button>
            </div>

            {filtro === 'mes' && (
              <input
                type="month"
                value={mesFiltro}
                onChange={(e) => setMesFiltro(e.target.value)}
                disabled={carregando}
                className="w-full px-1.5 py-0.5 text-[10px] border border-gray-300 rounded"
              />
            )}

            <div className="text-[11px] text-gray-600 leading-tight">{getTituloPrevisao()}</div>
          </div>
        )}
      </div>

      {/* Diário Previsto (scroll próprio) */}
      {!minimizado && (
        <div className="flex-1 min-h-0 overflow-y-auto p-1.5">
          {carregando ? (
            <p className="text-gray-500 text-center py-2" style={{ fontSize: '12px' }}>Carregando...</p>
          ) : caixaPrevistoGeral.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="text-[10px] text-gray-500 mb-0.5">
                Mostrando {caixaPrevistoGeral.length} dias
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-blue-50/50 border-b border-blue-100">
                    <th className="px-1 py-0.5 text-left font-semibold text-blue-800">Data</th>
                    <th className="px-1 py-0.5 text-right font-semibold text-blue-800">Receitas</th>
                    <th className="px-1 py-0.5 text-right font-semibold text-blue-800">Despesas</th>
                    <th className="px-1 py-0.5 text-right font-semibold text-blue-800">Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {caixaPrevistoGeral.map((dia, idx) => (
                    <tr key={`${dia.data}-${idx}`} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-1 py-0.5 text-gray-700 whitespace-nowrap">{dia.data_formatada}</td>
                      <td className="px-1 py-0.5 text-right text-green-600 font-medium">{formatarMoedaCompacta(dia.receitas)}</td>
                      <td className="px-1 py-0.5 text-right text-red-600 font-medium">{formatarMoedaCompacta(dia.despesas)}</td>
                      <td className={`px-1 py-0.5 text-right font-semibold ${dia.saldo_acumulado >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatarMoedaCompacta(dia.saldo_acumulado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-3">
              <p className="text-gray-500 text-xs">Nenhuma transação encontrada</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}