'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil, prepararDataParaInsert, calcularDataPorPrazo } from '@/lib/dateUtils'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'
import { formatarErro } from '@/lib/errorUtils'

interface ItemCondicional {
  id: string
  produto_id: string | null
  descricao: string
  quantidade: number
  preco_venda: number
  preco_custo: number
  valor_repasse: number
  categoria: string
  status: 'pendente' | 'devolvido' | 'efetivado'
  observacao?: string
  // Estado local para faturamento
  acao?: 'faturar' | 'pendente' | 'devolver'
}

interface ModalFaturarCondicionalProps {
  aberto: boolean
  onClose: () => void
  onSucesso: () => void
  transacaoId: string
}

export default function ModalFaturarCondicional({ aberto, onClose, onSucesso, transacaoId }: ModalFaturarCondicionalProps) {
  const { triggerRefresh } = useDadosFinanceiros()
  const [transacao, setTransacao] = useState<any>(null)
  const [itens, setItens] = useState<ItemCondicional[]>([])
  const [loading, setLoading] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')

  // Opções de Pagamento (caso fature)
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(1)
  const [prazoParcelas, setPrazoParcelas] = useState('mensal')
  const [dataVencimento, setDataVencimento] = useState(getDataAtualBrasil())
  const [acrescimoDesconto, setAcrescimoDesconto] = useState(0)

  const carregarDados = useCallback(async () => {
    setLoading(true)
    try {
      const { data: tc, error: errT } = await supabase.from('transacoes_condicionais').select('*').eq('id', transacaoId).single()
      if (errT) throw errT
      setTransacao(tc)

      const { data: its, error: errI } = await supabase
        .from('itens_condicionais')
        .select('*')
        .eq('transacao_id', transacaoId)
        .eq('status', 'pendente')

      if (errI) throw errI
      setItens((its || []).map(i => ({ ...i, acao: 'faturar' })))
    } catch (err: any) {
      console.error('Erro ao carregar condicional:', err)
      setErro(formatarErro(err))
    } finally {
      setLoading(false)
    }
  }, [transacaoId])

  useEffect(() => {
    if (aberto && transacaoId) {
      carregarDados()
    }
  }, [aberto, transacaoId, carregarDados])

  const handleAcaoItem = (itemId: string, acao: 'faturar' | 'pendente' | 'devolver') => {
    setItens(prev => prev.map(i => i.id === itemId ? { ...i, acao } : i))
  }

  const handleFinalizar = async () => {
    const itensFaturar = itens.filter(i => i.acao === 'faturar')
    const itensDevolver = itens.filter(i => i.acao === 'devolver')

    if (itensFaturar.length === 0 && itensDevolver.length === 0) {
      if (!window.confirm('Nenhum item será faturado ou devolvido. Deseja fechar?')) return
      onClose()
      return
    }

    setProcessando(true)
    setErro('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const numOriginal = transacao.numero_transacao
      const { data: nextNum } = await supabase.rpc('obter_proximo_numero_transacao')
      const numFaturamento = nextNum

      const isVenda = transacao.tipo === 'enviado'

      // 1. Criar Transação de Venda ou Compra se houver itens para faturar
      if (itensFaturar.length > 0) {
        const totalFaturadoItens = itensFaturar.reduce((acc, i) => acc + (i.quantidade * (isVenda ? i.preco_venda : i.valor_repasse)), 0)
        const totalFaturadoFinal = totalFaturadoItens + acrescimoDesconto
        const totalQtdItens = itensFaturar.reduce((acc, i) => acc + i.quantidade, 0)
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
          observacao: `Faturado do Condicional #${numOriginal}`,
          acrescimo,
          desconto,
          data_vencimento: prepararDataParaInsert(dataVencimento)
        }

        if (isVenda) {
          const { data: venda, error: errV } = await supabase.from('vendas').insert({
            ...payloadComum,
            data_venda: prepararDataParaInsert(getDataAtualBrasil()),
            cliente: transacao.origem,
          }).select().single()
          if (errV) throw errV
          transacaoPrincipalId = venda.id
        } else {
          const { data: compra, error: errC } = await supabase.from('compras').insert({
            ...payloadComum,
            data_compra: prepararDataParaInsert(getDataAtualBrasil()),
            fornecedor: transacao.origem,
          }).select().single()
          if (errC) throw errC
          transacaoPrincipalId = compra.id
        }

        // Itens da Transação e Ajustes de Estoque
        for (const it of itensFaturar) {
          const itemT = {
            [isVenda ? 'venda_id' : 'compra_id']: transacaoPrincipalId,
            produto_id: it.produto_id,
            descricao: it.descricao,
            quantidade: it.quantidade,
            preco_venda: it.preco_venda,
            preco_custo: it.preco_custo,
            valor_repasse: it.valor_repasse,
            categoria: it.categoria,
            observacao: it.observacao
          }
          const { error: errIt } = await supabase.from(isVenda ? 'itens_venda' : 'itens_compra').insert(itemT)
          if (errIt) throw errIt

          if (it.produto_id) {
            // Estornar do Condicional e Lançar no Realizado
            // Se isVenda: Condicional Saída (-), Realizado Saída (-)
            // Reverter Condicional: RPC +quantidade
            // Lançar Realizado: RPC -quantidade

            const multCond = isVenda ? 1 : -1
            const multReal = isVenda ? -1 : 1

            await supabase.rpc('atualizar_estoque_condicional', { produto_id_param: it.produto_id, quantidade_param: Math.round(it.quantidade * multCond) })
            await supabase.rpc('atualizar_estoque', { produto_id_param: it.produto_id, quantidade_param: Math.round(it.quantidade * multReal) })

            await supabase.from('movimentacoes_estoque').insert({
              produto_id: it.produto_id,
              tipo: isVenda ? 'saida' : 'entrada',
              quantidade: it.quantidade,
              observacao: `Faturamento Condicional #${numOriginal} -> Transação #${numFaturamento}`
            })
          }

          // Atualizar Item no Condicional
          await supabase.from('itens_condicionais').update({
            status: 'efetivado',
            valor_efetivado: isVenda ? it.preco_venda : it.valor_repasse,
            data_resolucao: new Date().toISOString()
          }).eq('id', it.id)
        }

        // Financeiro
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
                descricao: `${isVenda ? 'Venda' : 'Compra'} ${transacao.origem} (${i}/${quantidadeParcelas})`,
                total: valorFinalParcela,
                tipo: isVenda ? 'entrada' : 'saida',
                data: prepararDataParaInsert(dataParc),
                status_pagamento: 'pendente',
                quantidade_parcelas: quantidadeParcelas,
                [isVenda ? 'id_venda' : 'id_compra']: transacaoPrincipalId
            })
        }
      }

      // 2. Tratar itens devolvidos
      for (const it of itensDevolver) {
        if (it.produto_id) {
           const multCond = isVenda ? 1 : -1
           await supabase.rpc('atualizar_estoque_condicional', { produto_id_param: it.produto_id, quantidade_param: Math.round(it.quantidade * multCond) })

           await supabase.from('movimentacoes_estoque').insert({
              produto_id: it.produto_id,
              tipo: isVenda ? 'entrada' : 'saida',
              quantidade: it.quantidade,
              observacao: `Devolução Condicional #${numOriginal}`
            })
        }
        await supabase.from('itens_condicionais').update({
          status: 'devolvido',
          data_resolucao: new Date().toISOString()
        }).eq('id', it.id)
      }

      // 3. Recalcular Condicional
      const { data: itsRestantes } = await supabase.from('itens_condicionais').select('*').eq('transacao_id', transacaoId)
      const todosResolvidos = (itsRestantes || []).every(i => i.status !== 'pendente')

      if (todosResolvidos) {
        await supabase.from('transacoes_condicionais').update({ status: 'resolvido' }).eq('id', transacaoId)
      } else {
        // Se sobrou itens, podemos atualizar o total da transação condicional para refletir apenas o que sobrou
        const novoTotal = (itsRestantes || [])
          .filter(i => i.status === 'pendente')
          .reduce((acc, i) => acc + (i.quantidade * (isVenda ? i.preco_venda : i.valor_repasse)), 0)

        const novaQtd = (itsRestantes || [])
          .filter(i => i.status === 'pendente')
          .reduce((acc, i) => acc + i.quantidade, 0)

        await supabase.from('transacoes_condicionais').update({
          total: novoTotal,
          quantidade_itens: novaQtd
        }).eq('id', transacaoId)
      }

      triggerRefresh()
      onSucesso()
      setTimeout(() => alert('✅ Processado com sucesso!'), 100)
      onClose()
    } catch (err: any) {
      console.error('Erro no faturamento condicional:', err)
      setErro(formatarErro(err))
    } finally {
      setProcessando(false)
    }
  }

  if (!aberto) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] p-1 sm:p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[98vh] sm:max-h-[90vh] overflow-hidden flex flex-col border border-indigo-200">
        <div className="bg-indigo-700 text-white px-4 py-1.5 sm:py-2 flex justify-between items-center">
          <h2 className="font-bold text-sm uppercase tracking-wider">Resolver Condicional #{transacao?.numero_transacao}</h2>
          <button onClick={onClose} className="hover:bg-indigo-800 p-1 rounded">✕</button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-10 text-gray-500">Carregando itens...</div>
          ) : (
            <div className="space-y-4">
              <div className="bg-indigo-50 p-2 sm:p-3 rounded border border-indigo-200 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 text-xs">
                <div className="col-span-2 md:col-span-1">
                  <span className="block font-bold text-indigo-700 uppercase text-[10px]">Origem/Destino</span>
                  <span className="text-gray-900 font-bold text-sm">{transacao?.origem}</span>
                </div>
                <div>
                  <span className="block font-bold text-indigo-700 uppercase">Data Transação</span>
                  <span className="text-gray-900 font-semibold">{transacao?.data_transacao && new Date(transacao.data_transacao).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="block font-bold text-indigo-700 uppercase">Total Pendente</span>
                  <span className="text-gray-900 font-bold">R$ {transacao?.total?.toFixed(2)}</span>
                </div>
                <div>
                  <span className="block font-bold text-indigo-700 uppercase">Tipo</span>
                  <span className="bg-indigo-600 text-white px-2 py-0.5 rounded font-black">{transacao?.tipo?.toUpperCase()}</span>
                </div>
              </div>

              {erro && <div className="bg-red-100 text-red-700 p-2 rounded text-xs font-bold">{erro}</div>}

              <div className="border rounded overflow-hidden">
                <table className="w-full text-left text-[10px] sm:text-xs">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-2 sm:px-3 py-2 font-bold text-gray-600 uppercase">Item</th>
                      <th className="px-1 sm:px-3 py-2 font-bold text-gray-600 uppercase text-center w-[40px]">Qtd</th>
                      <th className="px-1 sm:px-3 py-2 font-bold text-gray-600 uppercase text-right w-[80px]">Preço</th>
                      <th className="px-2 sm:px-3 py-2 font-bold text-gray-600 uppercase text-center w-[120px] sm:w-[240px]">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {itens.map(item => (
                      <tr key={item.id} className={item.acao === 'faturar' ? 'bg-green-50' : item.acao === 'devolver' ? 'bg-orange-50' : ''}>
                        <td className="px-2 sm:px-3 py-2">
                          <div className="font-bold truncate max-w-[100px] sm:max-w-none">{item.descricao}</div>
                          <div className="text-[9px] text-gray-500 hidden sm:block">{item.categoria}</div>
                        </td>
                        <td className="px-1 sm:px-3 py-2 text-center font-bold">{item.quantidade}</td>
                        <td className="px-1 sm:px-3 py-2 text-right font-bold text-indigo-700 whitespace-nowrap">
                          R$ {(transacao.tipo === 'enviado' ? item.preco_venda : item.valor_repasse).toFixed(2)}
                        </td>
                        <td className="px-2 sm:px-3 py-2">
                          <div className="flex flex-wrap sm:flex-nowrap justify-center gap-1">
                            <button
                              onClick={() => handleAcaoItem(item.id, 'faturar')}
                              className={`flex-1 sm:flex-none px-1.5 sm:px-2 py-1 rounded text-[9px] sm:text-[10px] font-bold ${item.acao === 'faturar' ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-200 text-gray-600'}`}
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
                              onClick={() => handleAcaoItem(item.id, 'devolver')}
                              className={`flex-1 sm:flex-none px-1.5 sm:px-2 py-1 rounded text-[9px] sm:text-[10px] font-bold ${item.acao === 'devolver' ? 'bg-orange-600 text-white shadow-sm' : 'bg-gray-200 text-gray-600'}`}
                            >
                              DEVOLVER
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Opções de Faturamento (Sempre visível se houver algo para faturar) */}
              {itens.some(i => i.acao === 'faturar') && (
                <div className="bg-green-50 p-4 rounded border border-green-100">
                  <h3 className="font-bold text-green-700 text-xs mb-3 uppercase tracking-tight flex items-center gap-2">
                    💰 Condições do Faturamento (Venda/Compra)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Data Vencimento (1ª Parc)</label>
                      <input
                        type="date"
                        value={dataVencimento}
                        onChange={(e) => setDataVencimento(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-green-200 rounded outline-none bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Parcelas</label>
                      <input
                        type="number"
                        min="1"
                        value={quantidadeParcelas}
                        onChange={(e) => setQuantidadeParcelas(parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-1.5 text-xs border border-green-200 rounded outline-none bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Prazo</label>
                      <select
                        value={prazoParcelas}
                        onChange={(e) => setPrazoParcelas(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-green-200 rounded outline-none bg-white"
                      >
                        <option value="diaria">Diária</option>
                        <option value="semanal">Semanal</option>
                        <option value="mensal">Mensal</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-green-600 uppercase mb-1">Acrésc./Desc.</label>
                      <input
                        type="number"
                        step="0.01"
                        value={acrescimoDesconto}
                        onChange={(e) => setAcrescimoDesconto(Number(e.target.value))}
                        className="w-full px-2 py-1.5 text-xs border border-green-200 rounded outline-none bg-white font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded border flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-sm">
                  <span className="font-bold text-gray-600 uppercase mr-2">Subtotal Faturamento:</span>
                  <span className="text-xl font-black text-green-700">
                    R$ {(itens.filter(i => i.acao === 'faturar').reduce((acc, i) => acc + (i.quantidade * (transacao?.tipo === 'enviado' ? i.preco_venda : i.valor_repasse)), 0) + acrescimoDesconto).toFixed(2)}
                  </span>
                </div>
                <div className="text-xs text-gray-500 italic text-center">
                  * Faturar: Move do estoque condicional para o estoque real e gera financeiro.
                  <br />
                  * Devolver: Apenas retira do estoque condicional.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 sm:p-4 bg-gray-100 border-t flex flex-col sm:flex-row justify-between items-center gap-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded font-bold uppercase text-xs transition-all"
          >
            Sair
          </button>
          <button
            onClick={handleFinalizar}
            disabled={processando || itens.length === 0}
            className="w-full sm:w-auto px-8 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded font-black uppercase text-xs transition-all shadow-lg disabled:opacity-50"
          >
            {processando ? '...' : 'FINALIZAR RESOLUÇÃO'}
          </button>
        </div>
      </div>
    </div>
  )
}
