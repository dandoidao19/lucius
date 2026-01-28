'use client'

import React from 'react'
import { getDataAtualBrasil } from '@/lib/dateUtils'

// Interfaces sincronizadas com o CasaModulo
interface Lancamento {
  id: string
  descricao: string
  valor: number
  tipo: 'entrada' | 'saida'
  data_lancamento?: string
  data_prevista?: string
  centro_custo_id: string
  status: 'previsto' | 'realizado'
  parcelamento?: { atual: number; total: number }
  recorrencia?: unknown
  caixa_id?: string
  origem?: string
  centros_de_custo?: {
    nome: string
  }
}

export type PassoPagamentoCasa = 'inicial' | 'valor' | 'decisao' | 'nova_data'

interface ModalPagarState {
  aberto: boolean
  lancamento: Lancamento | null
  passo: PassoPagamentoCasa
  valorPago: number | null
  dataPagamento: string
  novaDataVencimento: string
  pagarTotal: boolean
}

interface ModalPagarAvancadoProps {
  modalPagar: ModalPagarState
  setModalPagar: React.Dispatch<React.SetStateAction<ModalPagarState>>
  processarPagamento: (criarNovaParcela?: boolean) => Promise<void>
}

export default function ModalPagarAvancado({ modalPagar, setModalPagar, processarPagamento }: ModalPagarAvancadoProps) {
  if (!modalPagar.aberto || !modalPagar.lancamento) return null

  const lancamento = modalPagar.lancamento
  const valorOriginal = lancamento.valor
  const valorPago = modalPagar.valorPago ?? valorOriginal
  const diff = valorPago - valorOriginal
  const eSaida = lancamento.tipo === 'saida'
  const labelDiff = diff > 0 ? (eSaida ? 'Desconto' : 'Juros') : (eSaida ? 'Juros' : 'Desconto')

  const fecharModal = () => setModalPagar({ 
    aberto: false, 
    lancamento: null, 
    passo: 'inicial',
    valorPago: null, 
    dataPagamento: getDataAtualBrasil(),
    novaDataVencimento: getDataAtualBrasil(),
    pagarTotal: true
  })

  const avancarPasso = (passo: PassoPagamentoCasa, valor?: number) => {
    setModalPagar(prev => ({
      ...prev,
      passo,
      valorPago: valor !== undefined ? valor : prev.valorPago,
    }))
  }

  const handleValorPagoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = parseFloat(e.target.value)
    setModalPagar(prev => ({ ...prev, valorPago: isNaN(valor) ? null : valor }))
  }

  const handleDataPagamentoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setModalPagar(prev => ({ ...prev, dataPagamento: e.target.value }))
  }

  const handleNovaDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setModalPagar(prev => ({ ...prev, novaDataVencimento: e.target.value }))
  }

  const handlePagarTotalToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    setModalPagar(prev => ({
      ...prev,
      pagarTotal: checked,
      valorPago: checked ? null : prev.valorPago
    }))
  }

  const renderPasso = () => {
    switch (modalPagar.passo) {
      case 'inicial':
        return (
          <>
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Confirmar Pagamento</h3>
              <div className="h-1 w-12 bg-green-500 rounded"></div>
            </div>
            
            <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4 rounded text-sm space-y-1">
              <p><span className="font-semibold text-gray-700">Lançamento:</span> {lancamento.descricao}</p>
              <p><span className="font-semibold text-gray-700">Valor Total:</span> <span className="text-lg font-bold text-green-700">R$ {lancamento.valor.toFixed(2)}</span></p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data do Pagamento *</label>
                <input
                  type="date"
                  value={modalPagar.dataPagamento}
                  onChange={handleDataPagamentoChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="pagarTotalCasa"
                  checked={modalPagar.pagarTotal}
                  onChange={handlePagarTotalToggle}
                  className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                />
                <label htmlFor="pagarTotalCasa" className="ml-2 text-sm font-medium text-gray-700">
                  Pagar valor total deste lançamento
                </label>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={fecharModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (modalPagar.pagarTotal) processarPagamento(false)
                  else avancarPasso('valor', 0)
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >
                {modalPagar.pagarTotal ? 'Confirmar Pagamento' : 'Próximo'}
              </button>
            </div>
          </>
        )
      case 'valor':
        return (
          <>
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Pagamento Parcial</h3>
              <div className="h-1 w-12 bg-yellow-500 rounded"></div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Quanto você está pagando? *</label>
              <input
                type="number"
                step="0.01"
                value={modalPagar.valorPago === null ? '' : modalPagar.valorPago}
                onChange={handleValorPagoChange}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none text-sm"
                placeholder="0.00"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">Valor original: R$ {lancamento.valor.toFixed(2)}</p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => avancarPasso('inicial')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={() => {
                  if (modalPagar.valorPago === null || modalPagar.valorPago <= 0) {
                    alert('Informe um valor válido.')
                    return
                  }
                  if (Math.abs(modalPagar.valorPago - lancamento.valor) < 0.01) {
                    processarPagamento(false)
                  } else {
                    avancarPasso('decisao')
                  }
                }}
                disabled={modalPagar.valorPago === null || modalPagar.valorPago <= 0}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition-colors"
              >
                Próximo
              </button>
            </div>
          </>
        )
      case 'decisao':
        return (
          <>
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">O que fazer com a diferença?</h3>
              <div className="h-1 w-12 bg-blue-500 rounded"></div>
            </div>

            <div className="bg-blue-50 p-4 mb-6 rounded text-sm space-y-2">
              <p><span className="font-semibold text-gray-700">Valor Pago:</span> <span className="font-bold">R$ {valorPago.toFixed(2)}</span></p>
              <p><span className="font-semibold text-gray-700">Diferença:</span> <span className={`font-bold ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>R$ {Math.abs(diff).toFixed(2)}</span></p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => processarPagamento(false)}
                className="w-full p-4 text-left border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-blue-300 transition-all group"
              >
                <p className="font-bold text-sm text-gray-800 group-hover:text-blue-600">Lançar como {labelDiff}</p>
                <p className="text-xs text-gray-500">O lançamento será marcado como pago e o valor será ajustado para o que foi pago.</p>
              </button>

              {diff < 0 && (
                <button
                  onClick={() => avancarPasso('nova_data')}
                  className="w-full p-4 text-left border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-blue-300 transition-all group"
                >
                  <p className="font-bold text-sm text-gray-800 group-hover:text-blue-600">Criar nova parcela com o valor restante</p>
                  <p className="text-xs text-gray-500">O valor de R$ {Math.abs(diff).toFixed(2)} será lançado em uma nova parcela prevista.</p>
                </button>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={() => avancarPasso('valor')} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Voltar</button>
            </div>
          </>
        )
      case 'nova_data':
        return (
          <>
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Vencimento da Nova Parcela</h3>
              <div className="h-1 w-12 bg-purple-500 rounded"></div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Data de Vencimento *</label>
              <input
                type="date"
                value={modalPagar.novaDataVencimento}
                onChange={handleNovaDataChange}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                Valor da nova parcela: <span className="font-bold text-red-600">R$ {Math.abs(valorOriginal - valorPago).toFixed(2)}</span>
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => avancarPasso('decisao')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={() => processarPagamento(true)}
                disabled={!modalPagar.novaDataVencimento}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                Confirmar e Gerar Parcela
              </button>
            </div>
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {renderPasso()}
        </div>
      </div>
    </div>
  )
}
