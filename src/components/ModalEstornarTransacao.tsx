'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'

interface ModalEstornarTransacaoProps {
  aberto: boolean
  transacao: {
    id: string
    tipo: 'entrada' | 'saida'
    descricao: string
    valor: number
    numero_transacao: number
    status_pagamento: string
    cliente_fornecedor?: string
    origem_id?: string
    valor_pago?: number
    juros_descontos?: number
    data_pagamento?: string
    id_venda?: string
    id_compra?: string
    id_condicional?: string
    id_pedido?: string
  } | null
  onClose: () => void
  onEstornoRealizado: () => void
}

export default function ModalEstornarTransacao({ 
  aberto, 
  transacao, 
  onClose, 
  onEstornoRealizado 
}: ModalEstornarTransacaoProps) {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const { recarregarDados } = useDadosFinanceiros()

  const handleEstornar = async () => {
    if (!transacao) return
    
    setLoading(true)
    setErro('')
    
    try {
      // 1. IDENTIFICAR E ESTORNAR TRANSAÇÃO PRINCIPAL (VENDA/COMPRA/PEDIDO/CONDICIONAL)
      const idPrincipal = transacao.id_venda || transacao.id_compra || transacao.id_condicional || transacao.id_pedido
      const tabelaPrincipal = transacao.id_venda ? 'vendas' :
                             transacao.id_compra ? 'compras' :
                             transacao.id_condicional ? 'transacoes_condicionais' :
                             transacao.id_pedido ? 'pedidos_loja' : null

      if (idPrincipal && tabelaPrincipal) {
        console.log(`🔄 Estornando status da transação principal (${tabelaPrincipal}): ${idPrincipal}`)
        const { error: errorPrincipal } = await supabase
          .from(tabelaPrincipal)
          .update({ status_pagamento: 'pendente' })
          .eq('id', idPrincipal)

        if (errorPrincipal) {
          console.warn('⚠️ Falha ao atualizar transação principal (pode não existir mais):', errorPrincipal.message)
        }
      }
      
      // 2. ESTORNAR APENAS A PARCELA SELECIONADA (LIMPAR dados de pagamento)
      console.log(`🔄 Estornando parcela específica: ${transacao.id}`)
      const { error: errorParcela } = await supabase
        .from('transacoes_loja')
        .update({
          status_pagamento: 'pendente',
          data_pagamento: null,
          valor_pago: null,
          juros_descontos: null
        })
        .eq('id', transacao.id)
      
      if (errorParcela) {
        console.error('❌ Erro ao estornar parcela:', errorParcela)
        throw new Error(`Erro ao estornar parcela: ${errorParcela.message}`)
      }
      
      // 3. ATUALIZAR CAIXA
      recarregarDados()
      
      console.log('✅ Estorno realizado com sucesso!')
      alert(`✅ Estorno da ${transacao.tipo === 'entrada' ? 'venda' : 'compra'} #${transacao.numero_transacao} realizado com sucesso!`)
      
      onEstornoRealizado()
      onClose()
    } catch (error) {
      console.error('❌ Erro ao processar estorno:', error)
      setErro(error instanceof Error ? error.message : 'Erro ao processar estorno. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (!aberto || !transacao) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirmar Estorno</h3>
            <div className="h-1 w-12 bg-yellow-500 rounded"></div>
          </div>
          
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6 rounded">
            <p className="text-sm text-gray-700 mb-2">
              <span className="font-semibold">Transação:</span> #{transacao.numero_transacao}
            </p>
            <p className="text-sm text-gray-700 mb-2">
              <span className="font-semibold">Cliente/Fornecedor:</span> {transacao.descricao}
            </p>
            <p className="text-sm text-gray-700 mb-2">
              <span className="font-semibold">Tipo:</span> {transacao.tipo === 'entrada' ? 'Venda' : 'Compra'}
            </p>
            <p className="text-sm text-gray-700 mb-2">
              <span className="font-semibold">Valor Original:</span> 
              <span className={`text-lg font-bold ml-2 ${transacao.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                {transacao.tipo === 'entrada' ? '+' : '-'} R$ {transacao.valor.toFixed(2)}
              </span>
            </p>
            {transacao.valor_pago && (
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Valor Pago:</span> 
                <span className="text-blue-600 font-bold ml-2">
                  R$ {transacao.valor_pago.toFixed(2)}
                </span>
              </p>
            )}
          </div>

          {erro && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-4 text-sm">
              {erro}
            </div>
          )}

          <p className="text-sm text-gray-600 mb-6">
            <span className="font-bold text-yellow-600">⚠️ ATENÇÃO:</span> Confirmar estorno total desta transação? 
            Esta ação reverterá o status para &quot;Pendente&quot;, limpará a data de pagamento, valor pago e juros/descontos.
          </p>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleEstornar}
              disabled={loading}
              className="px-4 py-2.5 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Processando...' : 'Confirmar Estorno'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}