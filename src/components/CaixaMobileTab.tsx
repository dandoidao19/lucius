'use client'

import { useState } from 'react'
import { useCaixaUniversal } from '@/hooks/useCaixaUniversal'

export default function CaixaMobileTab() {
  const {
    caixaRealCasa,
    caixaPrevistoGeral,
    carregando,
    filtro,
    setFiltro,
    mesFiltro,
    setMesFiltro,
  } = useCaixaUniversal('casa')

  const [expandirPeriodo, setExpandirPeriodo] = useState(false)

  const formatarMoeda = (valor: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)

  const handleMudarFiltro = (novoFiltro: '30dias' | 'mes' | 'tudo') => {
    setFiltro(novoFiltro)
    setExpandirPeriodo(false)
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Carregando caixa...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 min-h-[calc(100vh-120px)] lg:min-h-0">
      <div className="sticky z-30 space-y-1.5 bg-white pb-1.5" style={{ top: '0px' }}>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-2 border border-blue-200 shadow-sm">
          <div className="flex justify-between items-center gap-2">
            <div>
              <p className="text-[10px] text-blue-700 uppercase font-semibold leading-tight">Caixa Real</p>
              <p className="text-lg font-bold leading-tight text-blue-900 lg:text-xl">{formatarMoeda(caixaRealCasa)}</p>
            </div>
          </div>
        </div>

        <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
          <div className="p-2 bg-white space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-900 leading-tight">Filtros de previsão</p>
              </div>
              <button
                onClick={() => setExpandirPeriodo(!expandirPeriodo)}
                className="bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-md text-xs font-semibold transition-colors"
              >
                {expandirPeriodo ? 'Ocultar' : 'Abrir'} filtros
              </button>
            </div>

            {expandirPeriodo && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => handleMudarFiltro('30dias')}
                    className={`py-1 px-1.5 rounded text-[11px] font-semibold transition-colors ${
                      filtro === '30dias'
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100'
                    }`}
                  >
                    Próx. 30d
                  </button>
                  <button
                    onClick={() => handleMudarFiltro('mes')}
                    className={`py-1 px-1.5 rounded text-[11px] font-semibold transition-colors ${
                      filtro === 'mes'
                        ? 'bg-green-600 text-white'
                        : 'bg-green-50 text-green-700 border border-green-300 hover:bg-green-100'
                    }`}
                  >
                    Mês
                  </button>
                  <button
                    onClick={() => handleMudarFiltro('tudo')}
                    className={`py-1 px-1.5 rounded text-[11px] font-semibold transition-colors ${
                      filtro === 'tudo'
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-50 text-purple-700 border border-purple-300 hover:bg-purple-100'
                    }`}
                  >
                    Tudo
                  </button>
                </div>

                {filtro === 'mes' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Mês:</label>
                    <input
                      type="month"
                      value={mesFiltro}
                      onChange={(e) => setMesFiltro(e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                    />
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      </div>

      {caixaPrevistoGeral && caixaPrevistoGeral.length > 0 && (
        <div className="mt-1 flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
          <p className="text-[10px] font-semibold text-gray-600 uppercase leading-tight">Série de dias</p>
          {caixaPrevistoGeral.map((dia) => (
            <div key={dia.data} className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 text-xs truncate leading-tight">{dia.data_formatada}</p>
                <div className="mt-0.5 flex gap-2 text-[10px] text-gray-600 leading-tight">
                  <span className="text-emerald-600 truncate">↑ {formatarMoeda(dia.receitas)}</span>
                  <span className="text-red-600 truncate">↓ {formatarMoeda(dia.despesas)}</span>
                </div>
              </div>
              <p className={`text-xs font-bold whitespace-nowrap ${dia.saldo_acumulado >= 0 ? 'text-blue-600' : 'text-red-600 font-extrabold'}`}>
                {formatarMoeda(dia.saldo_acumulado)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
