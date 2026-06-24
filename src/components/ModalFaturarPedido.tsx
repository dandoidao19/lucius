'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil, prepararDataParaInsert, calcularDataPorPrazo, isDataValida } from '@/lib/dateUtils'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'

interface ItemPedido {
  id: string
  produto_id: string | null
  descricao: string
  quantidade: number
  preco_venda: number
  preco_custo: number
  valor_repasse: number
  categoria: string
  status: 'pendente' | 'efetuado' | 'cancelado'
  observacao_item?: string
  // Estado local para faturamento
  acao?: 'efetuar' | 'pendente' | 'cancelar'
}

interface ModalFaturarPedidoProps {
  aberto: boolean
  onClose: () => void
  onSucesso: () => void
  pedidoId: string
}

export default function ModalFaturarPedido({ aberto, onClose, onSucesso, pedidoId }: ModalFaturarPedidoProps) {
  const { triggerRefresh } = useDadosFinanceiros()
  const [pedido, setPedido] = useState<any>(null)
  const [itens, setItens] = useState<ItemPedido[]>([])
  const [loading, setLoading] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')

  // Opções de Pagamento Editáveis
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(1)
  const [prazoParcelas, setPrazoParcelas] = useState('mensal')
  const [dataVencimento, setDataVencimento] = useState(getDataAtualBrasil())
  const [acrescimoDesconto, setAcrescimoDesconto] = useState(0)

  const carregarDados = useCallback(async () => {
    setLoading(true)
    try {
      const { data: ped, error: errP } = await supabase.from('pedidos_loja').select('*').eq('id', pedidoId).single()
      if (errP) throw errP
      setPedido(ped)

      // Pre-encher opções de pagamento do pedido
      if (ped.quantidade_parcelas) setQuantidadeParcelas(ped.quantidade_parcelas)
      if (ped.prazoparcelas) setPrazoParcelas(ped.prazoparcelas)
      if (ped.data_vencimento) setDataVencimento(ped.data_vencimento)

      const { data: its, error: errI } = await supabase
        .from('itens_pedido_loja')
        .select('*')
        .eq('pedido_id', pedidoId)
        .eq('status', 'pendente')

      if (errI) throw errI
      setItens((its || []).map(i => ({ ...i, acao: 'efetuar' }))) // Default: efetuar todos os pendentes
    } catch (err: any) {
      console.error('Erro ao carregar pedido:', err)
      setErro(err.message)
    } finally {
      setLoading(false)
    }
  }, [pedidoId])

  useEffect(() => {
    if (aberto && pedidoId) {
      carregarDados()
    }
  }, [aberto, pedidoId, carregarDados])

  const handleAcaoItem = (itemId: string, acao: 'efetuar' | 'pendente' | 'cancelar') => {
    setItens(prev => prev.map(i => i.id === itemId ? { ...i, acao } : i))
  }

  const handleFinalizar = async () => {
    const itensEfetuar = itens.filter(i => i.acao === 'efetuar')
    const itensCancelar = itens.filter(i => i.acao === 'cancelar')

    if (itensEfetuar.length === 0 && itensCancelar.length === 0) {
      if (!window.confirm('Nenhum item será faturado ou cancelado. Deseja fechar?')) return
      onClose()
      return
    }

    setProcessando(true)
    setErro('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const numTransacaoBase = pedido.numero_transacao
      const { data: nextNum } = await supabase.rpc('obter_proximo_numero_transacao')
      const numFaturamento = nextNum

      // 1. Criar Transação de Venda ou Compra se houver itens para efetuar
      if (itensEfetuar.length > 0) {
        const totalFaturadoItens = itensEfetuar.reduce((acc, i) => acc + (i.quantidade * (pedido.tipo === 'venda' ? i.preco_venda : i.valor_repasse)), 0)
        const totalFaturadoFinal = totalFaturadoItens + acrescimoDesconto
        const totalQtdItens = itensEfetuar.reduce((acc, i) => acc + i.quantidade, 0)
        const acrescimo = acrescimoDesconto > 0 ? acrescimoDesconto : 0
        const desconto = acrescimoDesconto < 0 ? Math.abs(acrescimoDesconto) : 0

        let transacaoPrincipalId = ''
        const payloadComum = {
          numero_transacao: numFaturamento,
          total: totalFaturadoFinal,
          quantidade_itens: totalQtdItens,
          status_pagamento: 'pendente',
          quantidade_parcelas: quantidadeParcelas,
          prazoparcelas: prazoParcelas,
          observacao: `Faturado do Pedido #${numTransacaoBase}`,
          pedido_origem_id: pedido.id,
          acrescimo,
          desconto,
          data_vencimento: prepararDataParaInsert(dataVencimento)
        }

        if (pedido.tipo === 'venda') {
          const { data: venda, error: errV } = await supabase.from('vendas').insert({
            ...payloadComum,
            data_venda: prepararDataParaInsert(getDataAtualBrasil()),
            cliente: pedido.entidade,
          }).select().single()
          if (errV) throw errV
          transacaoPrincipalId = venda.id
        } else {
          const { data: compra, error: errC } = await supabase.from('compras').insert({
            ...payloadComum,
            data_compra: prepararDataParaInsert(getDataAtualBrasil()),
            fornecedor: pedido.entidade,
          }).select().single()
          if (errC) throw errC
          transacaoPrincipalId = compra.id
        }

        // Itens da Transação e Estoque
        for (const it of itensEfetuar) {
          const itemT = {
            [pedido.tipo === 'venda' ? 'venda_id' : 'compra_id']: transacaoPrincipalId,
            produto_id: it.produto_id,
            descricao: it.descricao,
            quantidade: it.quantidade,
            preco_venda: it.preco_venda,
            preco_custo: it.preco_custo,
            valor_repasse: it.valor_repasse,
            categoria: it.categoria,
            observacao: it.observacao_item
          }
          const { error: errIt } = await supabase.from(pedido.tipo === 'venda' ? 'itens_venda' : 'itens_compra').insert(itemT)
          if (errIt) throw errIt

          if (it.produto_id) {
            const mult = pedido.tipo === 'venda' ? -1 : 1
            await supabase.rpc('atualizar_estoque', { produto_id_param: it.produto_id, quantidade_param: Math.round(it.quantidade * mult) })
            await supabase.from('movimentacoes_estoque').insert({
              produto_id: it.produto_id,
              tipo: mult === -1 ? 'saida' : 'entrada',
              quantidade: it.quantidade,
              observacao: `Faturamento Pedido #${numTransacaoBase} -> Transação #${numFaturamento}`
            })
          }

          // Atualizar Item no Pedido
          await supabase.from('itens_pedido_loja').update({
            status: 'efetuado',
            observacao_item: `Efetivado na Transação #${numFaturamento}`
          }).eq('id', it.id)
        }

        // Financeiro da nova Transação
        const valorBase = Math.ceil((totalFaturadoFinal / quantidadeParcelas) * 100) / 100
        const valorUltima = Number((totalFaturadoFinal - (valorBase * (quantidadeParcelas - 1))).toFixed(2))

        let dataAtualParcela = dataVencimento || getDataAtualBrasil()
        for (let i = 1; i <= quantidadeParcelas; i++) {
            let dataParc = dataAtualParcela
            if (i > 1) {
                dataParc = calcularDataPorPrazo(dataAtualParcela, prazoParcelas)
                dataAtualParcela = dataParc
            }

            const valorFinalParcela = i === quantidadeParcelas ? valorUltima : valorBase

            await supabase.from('transacoes_loja').insert({
                user_id: user.id,
                numero_transacao: numFaturamento,
                descricao: `${pedido.tipo === 'venda' ? 'Venda' : 'Compra'} ${pedido.entidade} (${i}/${quantidadeParcelas})`,
                total: valorFinalParcela,
                tipo: pedido.tipo === 'venda' ? 'entrada' : 'saida',
                data: prepararDataParaInsert(dataParc),
                status_pagamento: 'pendente',
                quantidade_parcelas: quantidadeParcelas,
                [pedido.tipo === 'venda' ? 'id_venda' : 'id_compra']: transacaoPrincipalId
            })
        }
      }

      // 2. Tratar itens cancelados
      for (const it of itensCancelar) {
        await supabase.from('itens_pedido_loja').update({
          status: 'cancelado',
          observacao_item: 'Item Cancelado'
        }).eq('id', it.id)
      }

      // 3. Recalcular Pedido
      const { data: itsRestantes } = await supabase.from('itens_pedido_loja').select('*').eq('pedido_id', pedidoId)
      const pendentes = (itsRestantes || []).filter(i => i.status === 'pendente')

      const novoTotalFinanceiro = pendentes
        .reduce((acc, i) => acc + (i.quantidade * (pedido.tipo === 'venda' ? i.preco_venda : i.valor_repasse)), 0)

      const novaQtdItens = pendentes.reduce((acc, i) => acc + i.quantidade, 0)

      const todosFaturadosOuCancelados = (itsRestantes || []).every(i => i.status !== 'pendente')
      const novoStatus = todosFaturadosOuCancelados ? 'faturado' : 'parcial'

      await supabase.from('pedidos_loja').update({
        total_financeiro: novoTotalFinanceiro,
        quantidade_itens: novaQtdItens,
        status: novoStatus
      }).eq('id', pedidoId)

      // 4. Ajustar parcelas do Pedido (Apenas as pendentes)
      const { data: parcelasPendentes } = await supabase
        .from('transacoes_loja')
        .select('id')
        .eq('id_pedido', pedidoId)
        .eq('status_pagamento', 'pendente')

      if (parcelasPendentes && parcelasPendentes.length > 0) {
        if (novoTotalFinanceiro > 0) {
          const valorBase = Math.ceil((novoTotalFinanceiro / parcelasPendentes.length) * 100) / 100
          const valorUltima = Number((novoTotalFinanceiro - (valorBase * (parcelasPendentes.length - 1))).toFixed(2))

          for (let i = 0; i < parcelasPendentes.length; i++) {
            const valorFinalParcela = i === (parcelasPendentes.length - 1) ? valorUltima : valorBase
            await supabase
              .from('transacoes_loja')
              .update({ total: valorFinalParcela })
              .eq('id', parcelasPendentes[i].id)
          }
        } else {
          // Se não há mais saldo pendente, deleta as parcelas pendentes
          await supabase
            .from('transacoes_loja')
            .delete()
            .in('id', parcelasPendentes.map(p => p.id))
        }
      }

      triggerRefresh()
      onSucesso()
      setTimeout(() => alert('✅ Faturamento processado com sucesso!'), 100)
      onClose()
    } catch (err: any) {
      console.error('Erro no faturamento:', err)
      setErro(err.message)
    } finally {
      setProcessando(false)
    }
  }

  if (!aberto) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] p-1 sm:p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[98vh] sm:max-h-[90vh] overflow-hidden flex flex-col border border-purple-200">
        <div className="bg-purple-700 text-white px-4 py-1.5 sm:py-2 flex justify-between items-center">
          <h2 className="font-bold text-sm uppercase tracking-wider">Faturamento do Pedido #{pedido?.numero_transacao}</h2>
          <button onClick={onClose} className="hover:bg-purple-800 p-1 rounded">✕</button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-10 text-gray-500">Carregando itens...</div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 p-2 sm:p-3 rounded border border-blue-200 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 text-xs">
                <div className="col-span-2 md:col-span-1">
                  <span className="block font-bold text-blue-700 uppercase text-[10px]">Entidade</span>
                  <span className="text-gray-900 font-bold text-sm">{pedido?.entidade}</span>
                </div>
                <div>
                  <span className="block font-bold text-blue-700 uppercase">Data Pedido</span>
                  <span className="text-gray-900 font-semibold">{pedido?.data_pedido && new Date(pedido.data_pedido).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="block font-bold text-blue-700 uppercase">Total Geral</span>
                  <span className="text-gray-900 font-bold">R$ {pedido?.total_geral?.toFixed(2)}</span>
                </div>
                <div>
                  <span className="block font-bold text-blue-700 uppercase">Status Atual</span>
                  <span className="bg-blue-600 text-white px-2 py-0.5 rounded font-black">{pedido?.status?.toUpperCase()}</span>
                </div>
              </div>

              {erro && <div className="bg-red-100 text-red-700 p-2 rounded text-xs font-bold">{erro}</div>}

              <div className="border rounded overflow-hidden">
                <table className="w-full text-left text-[10px] sm:text-xs">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-2 sm:px-3 py-2 font-bold text-gray-600 uppercase">Item</th>
                      <th className="px-1 sm:px-3 py-2 font-bold text-gray-600 uppercase text-center w-[40px]">Qtd</th>
                      <th className="px-1 sm:px-3 py-2 font-bold text-gray-600 uppercase text-right w-[80px]">Total</th>
                      <th className="px-2 sm:px-3 py-2 font-bold text-gray-600 uppercase text-center w-[120px] sm:w-[220px]">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {itens.map(item => (
                      <tr key={item.id} className={item.acao === 'efetuar' ? 'bg-green-50' : item.acao === 'cancelar' ? 'bg-red-50' : ''}>
                        <td className="px-2 sm:px-3 py-2">
                          <div className="font-bold truncate max-w-[100px] sm:max-w-none">{item.descricao}</div>
                          <div className="text-[9px] text-gray-500 hidden sm:block">{item.categoria}</div>
                        </td>
                        <td className="px-1 sm:px-3 py-2 text-center font-bold">{item.quantidade}</td>
                        <td className="px-1 sm:px-3 py-2 text-right font-bold text-purple-700 whitespace-nowrap">
                          {(item.quantidade * (pedido.tipo === 'venda' ? item.preco_venda : item.valor_repasse)).toFixed(2)}
                        </td>
                        <td className="px-2 sm:px-3 py-2">
                          <div className="flex flex-wrap sm:flex-nowrap justify-center gap-1">
                            <button
                              onClick={() => handleAcaoItem(item.id, 'efetuar')}
                              className={`flex-1 sm:flex-none px-1.5 sm:px-2 py-1 rounded text-[9px] sm:text-[10px] font-bold ${item.acao === 'efetuar' ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-200 text-gray-600'}`}
                            >
                              FATURAR
                            </button>
                            <button
                              onClick={() => handleAcaoItem(item.id, 'pendente')}
                              className={`flex-1 sm:flex-none px-1.5 sm:px-2 py-1 rounded text-[9px] sm:text-[10px] font-bold ${item.acao === 'pendente' ? 'bg-yellow-500 text-white shadow-sm' : 'bg-gray-200 text-gray-600'}`}
                            >
                              ADIA
                            </button>
                            <button
                              onClick={() => handleAcaoItem(item.id, 'cancelar')}
                              className={`flex-1 sm:flex-none px-1.5 sm:px-2 py-1 rounded text-[9px] sm:text-[10px] font-bold ${item.acao === 'cancelar' ? 'bg-red-600 text-white shadow-sm' : 'bg-gray-200 text-gray-600'}`}
                            >
                              CANC.
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-gray-50 p-4 rounded border flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-sm">
                  <span className="font-bold text-gray-600 uppercase mr-2">Valor a Faturar:</span>
                  <span className="text-xl font-black text-green-700">
                    R$ {itens.filter(i => i.acao === 'efetuar').reduce((acc, i) => acc + (i.quantidade * (pedido?.tipo === 'venda' ? i.preco_venda : i.valor_repasse)), 0).toFixed(2)}
                  </span>
                </div>
                <div className="text-xs text-gray-500 italic text-center md:text-right">
                  * Novos lançamentos de {pedido?.tipo} e estoque serão gerados para os itens marcados como EFETUAR.
                </div>
              </div>

              {/* Informações de Pagamento Editáveis */}
              <div className="bg-purple-50 p-4 rounded border border-purple-100">
                <h3 className="font-bold text-purple-700 text-xs mb-3 uppercase tracking-tight flex items-center gap-2">
                  💳 Condições de Pagamento do Faturamento
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Data Vencimento (1ª Parc)</label>
                    <input
                      type="date"
                      value={dataVencimento}
                      onChange={(e) => setDataVencimento(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-purple-200 rounded focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Quantidade Parcelas</label>
                    <input
                      type="number"
                      min="1"
                      value={quantidadeParcelas}
                      onChange={(e) => setQuantidadeParcelas(parseInt(e.target.value) || 1)}
                      className="w-full px-2 py-1.5 text-xs border border-purple-200 rounded focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Prazo entre Parcelas</label>
                    <select
                      value={prazoParcelas}
                      onChange={(e) => setPrazoParcelas(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-purple-200 rounded focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                    >
                      <option value="diaria">Diária</option>
                      <option value="semanal">Semanal</option>
                      <option value="mensal">Mensal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-purple-600 uppercase mb-1">Acrésc./Desc. Faturamento</label>
                    <input
                      type="number"
                      step="0.01"
                      value={acrescimoDesconto}
                      onChange={(e) => setAcrescimoDesconto(Number(e.target.value))}
                      className="w-full px-2 py-1.5 text-xs border border-purple-200 rounded focus:ring-2 focus:ring-purple-500 outline-none bg-white font-bold"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Preview Parcelas Faturamento */}
                {quantidadeParcelas > 1 && (
                  <div className="mt-4 bg-slate-50 p-3 rounded-xl border border-purple-100 shadow-inner overflow-hidden">
                    <div className="flex items-center justify-between mb-2 px-1">
                       <p className="text-[9px] font-bold text-purple-900 uppercase tracking-widest">Cronograma de Faturamento</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                      {(() => {
                        const parcelasPreview = []
                        let dataPreview = dataVencimento
                        const totalFaturadoFinal = (itens.filter(i => i.acao === 'efetuar').reduce((acc, i) => acc + (i.quantidade * (pedido?.tipo === 'venda' ? i.preco_venda : i.valor_repasse)), 0)) + acrescimoDesconto
                        const valorBase = Math.ceil((totalFaturadoFinal / quantidadeParcelas) * 100) / 100
                        const valorUltima = Number((totalFaturadoFinal - (valorBase * (quantidadeParcelas - 1))).toFixed(2))

                        const dataBaseValida = isDataValida(dataVencimento)

                        for (let i = 0; i < Math.min(quantidadeParcelas, 60); i++) {
                          const dtP = i === 0 ? dataPreview : (dataBaseValida ? calcularDataPorPrazo(dataPreview, prazoParcelas) : dataPreview)
                          if (i > 0) dataPreview = dtP

                          parcelasPreview.push(
                            <div key={i} className="bg-white border border-slate-200 rounded-lg p-2.5 flex flex-col shadow-sm group hover:border-purple-400 transition-all">
                              <div className="flex justify-between items-center mb-1.5 border-b border-slate-50 pb-1.5">
                                 <span className="text-[10px] font-black text-slate-400 group-hover:text-purple-600 uppercase tracking-tighter italic">{i + 1}ª Parc.</span>
                                 <span className="text-xs font-bold text-slate-600">{dtP ? dtP.split('-').reverse().slice(0, 2).join('/') : '--/--'}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-black text-purple-800">R$ {(i === quantidadeParcelas - 1 ? valorUltima : valorBase).toFixed(2)}</span>
                              </div>
                            </div>
                          )
                        }
                        return parcelasPreview
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-3 sm:p-4 bg-gray-100 border-t flex flex-col sm:flex-row justify-between items-center gap-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded font-bold uppercase text-xs transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleFinalizar}
            disabled={processando || itens.length === 0}
            className="w-full sm:w-auto px-8 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded font-black uppercase text-xs transition-all shadow-lg disabled:opacity-50"
          >
            {processando ? '...' : 'FINALIZAR FATURAMENTO'}
          </button>
        </div>
      </div>
    </div>
  )
}
