'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil, prepararDataParaInsert, formatarDataParaExibicao } from '@/lib/dateUtils'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'

interface ModalPagarTransacaoProps {
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
    data?: string
    valor_pago?: number
    juros_descontos?: number
  } | null
  onClose: () => void
  onPagamentoRealizado: () => void
}

type PassoPagamento = 'inicial' | 'valor' | 'decisao' | 'nova_data'

export default function ModalPagarTransacao({ 
  aberto, 
  transacao, 
  onClose, 
  onPagamentoRealizado 
}: ModalPagarTransacaoProps) {
  const [passo, setPasso] = useState<PassoPagamento>('inicial')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [dataPagamento, setDataPagamento] = useState(getDataAtualBrasil())
  const [pagarValorTotal, setPagarValorTotal] = useState(true)
  const [valorPago, setValorPago] = useState(0)
  const [novaDataVencimento, setNovaDataVencimento] = useState(getDataAtualBrasil())
  const { recarregarDados } = useDadosFinanceiros()

  useEffect(() => {
    if (aberto && transacao) {
      setPasso('inicial')
      setDataPagamento(getDataAtualBrasil())
      setPagarValorTotal(true)
      setValorPago(transacao.valor)
      setNovaDataVencimento(getDataAtualBrasil())
      setErro('')
    }
  }, [aberto, transacao])

  const formatarDataParaInput = (dataISO: string) => {
    if (!dataISO) return ''
    
    try {
      if (dataISO.includes('/')) {
        const [dia, mes, ano] = dataISO.split('/')
        return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
      }
      return dataISO
    } catch {
      return dataISO
    }
  }

  const handleDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value
    setDataPagamento(valor)
  }

  const handleValorPagoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = parseFloat(e.target.value) || 0
    setValorPago(valor)
  }

  const validarDados = () => {
    if (!dataPagamento) {
      setErro('Data do pagamento é obrigatória')
      return false
    }

    if (!pagarValorTotal && valorPago <= 0) {
      setErro('Valor pago deve ser maior que zero')
      return false
    }

    if (dataPagamento && new Date(dataPagamento) > new Date()) {
      if (!confirm('⚠️ Data de pagamento é futura. Deseja continuar?')) {
        return false
      }
    }

    return true
  }

  const handlePagar = async (criarNovaParcela: boolean = false) => {
    if (!transacao) return
    
    if (!validarDados()) {
      return
    }
    
    setLoading(true)
    setErro('')
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const dataPagamentoFormatada = prepararDataParaInsert(dataPagamento)
      const valorOriginal = transacao.valor
      const valorRestante = valorOriginal - valorPago
      
      // Se for criar nova parcela, o juros/desconto do pagamento atual é 0
      const jurosDescontosFinal = criarNovaParcela ? 0 : (valorPago - valorOriginal)
      
      const statusPagamento = 'pago'

      if (transacao.origem_id) {
        // 1. ATUALIZAR TRANSAÇÃO ATUAL
        const updateData: Record<string, string | number | null> = {
          status_pagamento: statusPagamento,
          data_pagamento: dataPagamentoFormatada,
          valor_pago: valorPago,
          juros_descontos: jurosDescontosFinal
        }

        // Se for criar nova parcela, ajustar o valor da atual para o que foi pago
        if (criarNovaParcela) {
          updateData.total = valorPago
        }

        const { error: errorTransacaoLoja } = await supabase
          .from('transacoes_loja')
          .update(updateData)
          .eq('id', transacao.origem_id)
        
        if (errorTransacaoLoja) throw errorTransacaoLoja
        
        // 2. CRIAR NOVA PARCELA SE SOLICITADO
        if (criarNovaParcela && valorRestante > 0.01) {
          const { data: proximoNumero } = await supabase.rpc('obter_proximo_numero_transacao')
          
          const novaParcela = {
            user_id: user.id,
            numero_transacao: proximoNumero,
            descricao: transacao.descricao,
            total: valorRestante,
            tipo: transacao.tipo,
            data: prepararDataParaInsert(novaDataVencimento),
            status_pagamento: 'pendente'
          }

          const { error: errorInsert } = await supabase
            .from('transacoes_loja')
            .insert(novaParcela)
          
          if (errorInsert) throw errorInsert
        }

        // 3. ATUALIZAR STATUS NA TABELA DE ORIGEM (VENDAS/COMPRAS)
        // Se pagou total (ou juros/desconto), status vira 'pago'
        // Se criou nova parcela, o status da venda/compra como um todo pode ser 'parcial' ou manter 'pendente'
        // Mas o sistema parece usar 'pago' para quando a parcela específica é resolvida.
        const tabelaOrigem = transacao.tipo === 'entrada' ? 'vendas' : 'compras'
        const campoNome = transacao.tipo === 'entrada' ? 'cliente' : 'fornecedor'

        const { error: errorOrigem } = await supabase
          .from(tabelaOrigem)
          .update({
            status_pagamento: criarNovaParcela ? 'pendente' : 'pago' // Se gerou nova parcela, a transação mestre ainda tem pendência
          })
          .ilike(campoNome, `%${transacao.descricao.replace(/\(\d+\/\d+\)/, '').trim()}%`)
          .eq('numero_transacao', transacao.numero_transacao)

        if (errorOrigem) console.warn('⚠️ Erro ao atualizar origem:', errorOrigem.message)
      }
      
      recarregarDados()
      
      let mensagem = `✅ Pagamento processado com sucesso!`
      if (criarNovaParcela) {
        mensagem += ` Nova parcela de R$ ${valorRestante.toFixed(2)} gerada para ${formatarDataParaExibicao(novaDataVencimento)}.`
      }
      
      alert(mensagem)
      onPagamentoRealizado()
      onClose()
    } catch (error) {
      console.error('❌ Erro ao processar pagamento:', error)
      setErro(error instanceof Error ? error.message : 'Erro ao processar pagamento.')
    } finally {
      setLoading(false)
    }
  }

  if (!aberto || !transacao) return null

  const dataInputValue = formatarDataParaInput(dataPagamento)

  const renderPasso = () => {
    switch (passo) {
      case 'inicial':
        return (
          <>
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Confirmar Pagamento</h3>
              <div className="h-1 w-12 bg-green-500 rounded"></div>
            </div>

            <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4 rounded text-sm space-y-1">
              <p><span className="font-semibold text-gray-700">Descrição:</span> {transacao.descricao}</p>
              <p><span className="font-semibold text-gray-700">Valor Parcela:</span> <span className="text-lg font-bold text-green-700">R$ {transacao.valor.toFixed(2)}</span></p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data do Pagamento *</label>
                <input
                  type="date"
                  value={dataInputValue}
                  onChange={handleDataChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="pagarTotal"
                  checked={pagarValorTotal}
                  onChange={(e) => {
                    setPagarValorTotal(e.target.checked)
                    if (e.target.checked) setValorPago(transacao.valor)
                  }}
                  className="w-4 h-4 text-green-600 rounded"
                />
                <label htmlFor="pagarTotal" className="ml-2 text-sm font-medium text-gray-700">
                  Pagar valor total da parcela
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
              <button
                onClick={() => {
                  if (pagarValorTotal) handlePagar()
                  else setPasso('valor')
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                {pagarValorTotal ? 'Confirmar Pagamento' : 'Próximo'}
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
                value={valorPago}
                onChange={handleValorPagoChange}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none text-sm"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">Valor da parcela original: R$ {transacao.valor.toFixed(2)}</p>
            </div>

            <div className="flex justify-end space-x-3">
              <button onClick={() => setPasso('inicial')} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Voltar</button>
              <button
                onClick={() => {
                  if (valorPago <= 0) return alert('Informe um valor válido')
                  if (Math.abs(valorPago - transacao.valor) < 0.01) handlePagar()
                  else setPasso('decisao')
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700"
              >
                Próximo
              </button>
            </div>
          </>
        )
      case 'decisao':
        const diff = valorPago - transacao.valor
        const eSaida = transacao.tipo === 'saida'
        const labelDiff = diff > 0 ? (eSaida ? 'Desconto' : 'Juros') : (eSaida ? 'Juros' : 'Desconto')

        return (
          <>
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">O que fazer com a diferença?</h3>
              <div className="h-1 w-12 bg-blue-500 rounded"></div>
            </div>

            <div className="bg-blue-50 p-4 mb-6 rounded text-sm space-y-2">
              <p><span className="font-semibold">Valor Pago:</span> R$ {valorPago.toFixed(2)}</p>
              <p><span className="font-semibold">Diferença:</span> <span className={diff > 0 ? 'text-green-600' : 'text-red-600'}>R$ {Math.abs(diff).toFixed(2)}</span></p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handlePagar(false)}
                className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <p className="font-bold text-sm text-gray-800">Lançar como {labelDiff}</p>
                <p className="text-xs text-gray-500">A parcela será marcada como paga e a diferença será registrada como juros ou desconto.</p>
              </button>

              {diff < 0 && (
                <button
                  onClick={() => setPasso('nova_data')}
                  className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <p className="font-bold text-sm text-gray-800">Criar nova parcela com o valor restante</p>
                  <p className="text-xs text-gray-500">O valor de R$ {Math.abs(diff).toFixed(2)} será lançado em uma nova parcela pendente.</p>
                </button>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={() => setPasso('valor')} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Voltar</button>
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
                value={novaDataVencimento}
                onChange={(e) => setNovaDataVencimento(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
              />
              <p className="text-xs text-gray-500 mt-2">Valor da nova parcela: R$ {(transacao.valor - valorPago).toFixed(2)}</p>
            </div>

            <div className="flex justify-end space-x-3">
              <button onClick={() => setPasso('decisao')} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Voltar</button>
              <button
                onClick={() => handlePagar(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
              >
                Confirmar e Gerar Parcela
              </button>
            </div>
          </>
        )
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          {erro && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-4 text-sm">
              {erro}
            </div>
          )}
          {loading ? (
            <div className="py-10 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500 mx-auto mb-4"></div>
              <p className="text-sm text-gray-600">Processando pagamento...</p>
            </div>
          ) : (
            renderPasso()
          )}
        </div>
      </div>
    </div>
  )
}