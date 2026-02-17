'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatarDataParaExibicao } from '@/lib/dateUtils'
import { formatarErro } from '@/lib/errorUtils'
import ModalTransacaoUnificada from './ModalTransacaoUnificada'
import ModalFaturarPedido from './ModalFaturarPedido'

interface ItemDetalhe {
  id: string
  produto_id: string | null
  descricao: string
  quantidade: number
  preco_venda: number
  preco_custo: number
  valor_repasse: number
  categoria?: string
  observacao?: string
  status?: string
}

interface ParcelaDetalhe {
  id: string
  data: string
  valor: number
  status: string
  descricao: string
}

interface ModalDetalhesTransacaoProps {
  aberto: boolean
  onClose: () => void
  onSucesso?: () => void
  transacaoId: string
  tipo: 'vendas' | 'compras' | 'transacoes_condicionais' | 'pedidos_loja'
  dadosResumo: {
    numero: number
    data: string
    entidade: string
    total: number
    total_financeiro?: number
    status: string
    observacao: string
  }
}

export default function ModalDetalhesTransacao({ aberto, onClose, onSucesso, transacaoId, tipo, dadosResumo }: ModalDetalhesTransacaoProps) {
  const [itens, setItens] = useState<ItemDetalhe[]>([])
  const [parcelas, setParcelas] = useState<ParcelaDetalhe[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingExcluir, setLoadingExcluir] = useState(false)
  const [transacaoFull, setTransacaoFull] = useState<any>(null)
  const [editAberto, setEditAberto] = useState(false)
  const [faturarAberto, setFaturarAberto] = useState(false)

  const buscarFull = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from(tipo)
        .select('*')
        .eq('id', transacaoId)
        .single()

      if (error) throw error
      setTransacaoFull(data)
    } catch (err) {
      console.error('Erro ao buscar transação full:', err)
    }
  }, [transacaoId, tipo])

  const buscarItens = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase.from(
        tipo === 'vendas' ? 'itens_venda' :
        tipo === 'compras' ? 'itens_compra' :
        tipo === 'pedidos_loja' ? 'itens_pedido_loja' :
        'itens_condicionais'
      ).select('*')

      if (tipo === 'vendas') query = query.eq('venda_id', transacaoId)
      else if (tipo === 'compras') query = query.eq('compra_id', transacaoId)
      else if (tipo === 'pedidos_loja') query = query.eq('pedido_id', transacaoId)
      else query = query.eq('transacao_id', transacaoId)

      const { data, error } = await query

      if (error) throw error

      const itensFormatados = (data || []).map((item: any) => ({
        id: item.id,
        produto_id: item.produto_id,
        descricao: item.descricao || '',
        quantidade: item.quantidade || 0,
        preco_venda: item.preco_venda || 0,
        preco_custo: item.preco_custo || 0,
        valor_repasse: item.valor_repasse || 0,
        categoria: item.categoria,
        observacao: item.observacao || item.observacao_item || '',
        status: item.status || 'pendente'
      }))

      setItens(itensFormatados)
    } catch (err) {
      console.error('Erro ao buscar itens do detalhamento:', err)
    } finally {
      setLoading(false)
    }
  }, [transacaoId, tipo])

  const handleExcluir = async () => {
    if (!window.confirm(`⚠️ TEM CERTEZA? Esta ação irá EXCLUIR permanentemente esta transação e REVERTER todos os impactos no ESTOQUE e FINANCEIRO.`)) {
      return
    }

    setLoadingExcluir(true)
    try {
      // 1. Reverter Estoque
      for (const item of itens) {
        let prodId = item.produto_id

        if (!prodId) {
          const { data: prod } = await supabase
            .from('produtos')
            .select('id')
            .ilike('descricao', item.descricao)
            .limit(1)
            .maybeSingle()
          if (prod) prodId = prod.id
        }

        if (prodId) {
          // Inverter impacto: Venda (saída) -> vira entrada (+). Compra (entrada) -> vira saída (-).
          // Condicional Enviado (saída) -> vira entrada (+). Condicional Recebido (entrada) -> vira saída (-).

          let multiplicador = 1
          if (tipo === 'vendas' || (tipo === 'transacoes_condicionais' && transacaoFull?.tipo === 'enviado')) {
             multiplicador = 1 // Devolve pro estoque
          } else if (tipo === 'compras' || (tipo === 'transacoes_condicionais' && transacaoFull?.tipo === 'recebido')) {
             multiplicador = -1 // Retira do estoque
          } else if (tipo === 'pedidos_loja') {
             multiplicador = 0 // Pedido não impacta estoque diretamente (v4.9)
          }

          if (multiplicador !== 0) {
            await supabase.rpc('atualizar_estoque', {
              produto_id_param: prodId,
              quantidade_param: item.quantidade * multiplicador
            })

            await supabase.from('movimentacoes_estoque').insert({
              produto_id: prodId,
              tipo: multiplicador === 1 ? 'entrada' : 'saida',
              quantidade: item.quantidade,
              observacao: `EXTORNO/EXCLUSÃO: #${dadosResumo.numero} (${tipo})`
            })
          }
        }
      }

      // 2. Deletar Financeiro (transacoes_loja)
      let queryDel = supabase.from('transacoes_loja').delete()
      if (tipo === 'vendas') queryDel = queryDel.eq('id_venda', transacaoId)
      else if (tipo === 'compras') queryDel = queryDel.eq('id_compra', transacaoId)
      else if (tipo === 'pedidos_loja') queryDel = queryDel.eq('id_pedido', transacaoId)
      else queryDel = queryDel.eq('id_condicional', transacaoId)

      const { error: errorDel } = await queryDel

      // Fallback agressivo para garantir que nada sobrou
      const prefixo = tipo === 'vendas' ? 'Venda' : (tipo === 'compras' ? 'Compra' : '')
      if (prefixo) {
        await supabase.from('transacoes_loja')
          .delete()
          .eq('numero_transacao', dadosResumo.numero)
          .ilike('descricao', `${prefixo}%${dadosResumo.entidade}%`)
      } else {
        // Para pedidos e condicionais, buscar pela observação que contém o vínculo
        await supabase.from('transacoes_loja')
          .delete()
          .eq('numero_transacao', dadosResumo.numero)
          .ilike('observacao', `%Ref. #${dadosResumo.numero}%`)
      }

      // 3. Deletar a Transação Principal e Itens
      if (tipo === 'vendas') {
        await supabase.from('itens_venda').delete().eq('venda_id', transacaoId)
        await supabase.from('vendas').delete().eq('id', transacaoId)
      } else if (tipo === 'compras') {
        await supabase.from('itens_compra').delete().eq('compra_id', transacaoId)
        await supabase.from('compras').delete().eq('id', transacaoId)
      } else if (tipo === 'pedidos_loja') {
        await supabase.from('itens_pedido_loja').delete().eq('pedido_id', transacaoId)
        await supabase.from('pedidos_loja').delete().eq('id', transacaoId)
      } else if (tipo === 'transacoes_condicionais') {
        await supabase.from('itens_condicionais').delete().eq('transacao_id', transacaoId)
        await supabase.from('transacoes_condicionais').delete().eq('id', transacaoId)
      }

      alert('✅ Transação excluída com sucesso!')
      if (onSucesso) onSucesso()
      onClose()
    } catch (err) {
      const msg = formatarErro(err)
      console.error('Erro ao excluir transação:', err, msg)
      alert('❌ Erro ao excluir transação: ' + msg)
    } finally {
      setLoadingExcluir(false)
    }
  }

  const buscarParcelas = useCallback(async () => {
    try {
      let query = supabase.from('transacoes_loja').select('*')

      if (tipo === 'vendas') query = query.eq('id_venda', transacaoId)
      else if (tipo === 'compras') query = query.eq('id_compra', transacaoId)
      else if (tipo === 'pedidos_loja') query = query.eq('id_pedido', transacaoId)
      else query = query.eq('id_condicional', transacaoId)

      let { data, error } = await query.order('data', { ascending: true })

      if (error) throw error

      // Fallback para registros antigos ou sem vínculo direto
      if (!data || data.length === 0) {
        const prefixo = tipo === 'vendas' ? 'Venda' : 'Compra'
        const { data: fallbackData } = await supabase
          .from('transacoes_loja')
          .select('*')
          .ilike('descricao', `${prefixo}%${dadosResumo.entidade}%`)
          .eq('numero_transacao', dadosResumo.numero)
          .order('data', { ascending: true })
        data = fallbackData
      }

      const parcelasFormatadas = (data || []).map((p: { id: string; data: string; total: number; status_pagamento: string; descricao: string }) => ({
        id: p.id,
        data: p.data,
        valor: p.total,
        status: p.status_pagamento,
        descricao: p.descricao
      }))

      setParcelas(parcelasFormatadas)
    } catch (err) {
      console.error('Erro ao buscar parcelas:', err)
    }
  }, [tipo, transacaoId, dadosResumo.entidade, dadosResumo.numero])

  useEffect(() => {
    if (aberto && transacaoId) {
      buscarFull()
      buscarItens()
      buscarParcelas()
    }
  }, [aberto, transacaoId, buscarFull, buscarItens, buscarParcelas])

  if (!aberto) return null

  const handleEditClick = () => {
    setEditAberto(true)
  }

  const handleEditSucesso = () => {
    setEditAberto(false)
    if (onSucesso) onSucesso()
    onClose()
  }

  if (editAberto && transacaoFull) {
    const isPedido = transacaoFull.observacao?.includes('[PEDIDO]') || tipo === 'pedidos_loja'
    let tipoMapeado = ''
    if (tipo === 'vendas') tipoMapeado = 'venda'
    else if (tipo === 'compras') tipoMapeado = 'compra'
    else if (tipo === 'pedidos_loja') {
      tipoMapeado = transacaoFull.tipo === 'venda' ? 'pedido_venda' : 'pedido_compra'
    } else {
      if (isPedido) {
        tipoMapeado = transacaoFull.tipo === 'enviado' ? 'pedido_venda' : 'pedido_compra'
      } else {
        tipoMapeado = transacaoFull.tipo === 'enviado' ? 'condicional_cliente' : 'condicional_fornecedor'
      }
    }

    // Mapear dados para o formato esperado pelo ModalTransacaoUnificada
    const transacaoInicial = {
      id: transacaoId,
      tipo: tipoMapeado as 'venda' | 'compra' | 'pedido_venda' | 'pedido_compra' | 'condicional_cliente' | 'condicional_fornecedor',
      data: (tipo === 'vendas' ? transacaoFull.data_venda : (tipo === 'compras' ? transacaoFull.data_compra : (tipo === 'pedidos_loja' ? transacaoFull.data_pedido : transacaoFull.data_transacao))) as string,
      entidade: (tipo === 'vendas' ? transacaoFull.cliente : (tipo === 'compras' ? transacaoFull.fornecedor : (tipo === 'pedidos_loja' ? transacaoFull.entidade : transacaoFull.origem))) as string,
      total: (transacaoFull.total || transacaoFull.total_geral) as number || 0,
      status_pagamento: (transacaoFull.status_pagamento || transacaoFull.status || 'pendente') as string,
      quantidade_parcelas: (transacaoFull.quantidade_parcelas as number) || 1,
      prazoparcelas: (transacaoFull.prazoparcelas as string) || 'mensal',
      observacao: (transacaoFull.observacao as string) || '',
      numero_transacao: transacaoFull.numero_transacao as number,
      itens: itens.map(i => ({
        id: i.id,
        produto_id: i.produto_id,
        descricao: i.descricao,
        quantidade: i.quantidade,
        categoria: i.categoria || '',
        preco_custo: i.preco_custo,
        valor_repasse: i.valor_repasse,
        preco_venda: i.preco_venda,
        observacao_item: i.observacao,
        codigo: '',
        estoque_atual: 0,
        minimizado: true,
        isNovoCadastro: false
      }))
    }

    return (
      <ModalTransacaoUnificada
        aberto={editAberto}
        onClose={() => setEditAberto(false)}
        onSucesso={handleEditSucesso}
        transacaoInicial={transacaoInicial}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-2">
      <div className="bg-white rounded shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] border border-purple-200">
        {/* Cabeçalho */}
        <div className="bg-purple-900 text-white px-4 py-1 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <span className="text-blue-400">#{dadosResumo.numero}</span> Detalhes da {tipo === 'vendas' ? 'Venda' : tipo === 'compras' ? 'Compra' : tipo === 'pedidos_loja' ? 'Pedido' : 'Transação'}
            </h2>
            <p className="text-xs text-gray-400">{formatarDataParaExibicao(dadosResumo.data)}</p>
          </div>
          <button onClick={onClose} className="hover:bg-gray-700 p-1 rounded transition-colors text-lg">✕</button>
        </div>

        <div className="p-2 overflow-y-auto space-y-2 text-xs">
          {/* Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-gray-50 p-1.5 rounded border">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Entidade</p>
              <p className="font-bold text-gray-800 truncate">{dadosResumo.entidade}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Status</p>
              <span className={`inline-block text-xs font-black px-1.5 rounded ${
                dadosResumo.status === 'pago' || dadosResumo.status === 'resolvido' ? 'bg-green-600 text-white' :
                dadosResumo.status === 'faturado' ? 'bg-purple-600 text-white' :
                dadosResumo.status === 'parcial' ? 'bg-blue-600 text-white' :
                dadosResumo.status === 'cancelado' ? 'bg-gray-500 text-white' :
                'bg-yellow-500 text-white'
              }`}>
                {dadosResumo.status.toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">{tipo === 'pedidos_loja' ? 'Total Geral' : 'Total'}</p>
              <p className="text-sm font-black text-purple-700">R$ {dadosResumo.total.toFixed(2)}</p>
              {tipo === 'pedidos_loja' && dadosResumo.total_financeiro !== undefined && (
                <div className="mt-1">
                   <p className="text-[10px] font-bold text-gray-500 uppercase">Total Financeiro (Saldo)</p>
                   <p className="text-xs font-black text-green-700">R$ {dadosResumo.total_financeiro.toFixed(2)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Observações (se houver) */}
          {dadosResumo.observacao && (
            <div className="bg-purple-50 p-2 rounded border border-purple-100">
              <p className="text-xs font-bold text-purple-600 uppercase mb-0.5">Observações</p>
              <p className="italic text-purple-800">{dadosResumo.observacao}</p>
            </div>
          )}

          {/* Itens (No topo) */}
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-gray-700 flex items-center gap-1">
              📦 Itens ({itens.length})
            </h3>
            <div className="border rounded overflow-x-auto shadow-sm">
              <table className="w-full text-left min-w-[500px]">
                <thead className="bg-gray-100 border-b">
                  <tr className="text-xs">
                    <th className="px-2 py-1 font-bold text-gray-600 uppercase">Descrição</th>
                    <th className="px-2 py-1 font-bold text-gray-600 uppercase">Categoria</th>
                    <th className="px-2 py-1 font-bold text-gray-600 uppercase text-center">Qtd</th>
                    <th className="px-2 py-1 font-bold text-gray-600 uppercase text-right">Unitário</th>
                    <th className="px-2 py-1 font-bold text-gray-600 uppercase text-right">Subtotal</th>
                    <th className="px-2 py-1 font-bold text-gray-600 uppercase text-center">Status</th>
                    <th className="px-2 py-1 font-bold text-gray-600 uppercase">Obs. Item</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {loading ? (
                    <tr><td colSpan={7} className="px-2 py-4 text-center text-gray-400 italic">Buscando...</td></tr>
                  ) : itens.length === 0 ? (
                    <tr><td colSpan={7} className="px-2 py-4 text-center text-gray-400 italic">Vazio</td></tr>
                  ) : (
                    itens.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-2 py-1">
                          <div className="font-medium text-gray-800">{item.descricao}</div>
                        </td>
                        <td className="px-2 py-1 text-gray-600">{item.categoria || '—'}</td>
                        <td className="px-2 py-1 text-center">{item.quantidade}</td>
                        <td className="px-2 py-1 text-right">R$ {(tipo === 'vendas' ? item.preco_venda : item.valor_repasse).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right font-bold text-gray-900">R$ {(item.quantidade * (tipo === 'vendas' ? item.preco_venda : item.valor_repasse)).toFixed(2)}</td>
                        <td className="px-2 py-1 text-center">
                           <span className={`inline-block px-1 rounded text-[10px] font-bold uppercase ${
                             item.status === 'efetuado' ? 'bg-green-100 text-green-700' :
                             item.status === 'cancelado' ? 'bg-red-100 text-red-700' :
                             'bg-yellow-100 text-yellow-700'
                           }`}>
                             {item.status}
                           </span>
                        </td>
                        <td className="px-2 py-1 text-gray-500 italic truncate max-w-[200px]" title={item.observacao}>
                          {item.observacao || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {!loading && itens.length > 0 && (
                  <tfoot className="bg-purple-50 font-bold border-t text-xs">
                    <tr>
                      <td colSpan={4} className="px-2 py-1 text-right uppercase">Total Itens:</td>
                      <td className="px-2 py-1 text-right text-purple-700">R$ {itens.reduce((acc, i) => acc + (i.quantidade * (tipo === 'vendas' ? i.preco_venda : i.valor_repasse)), 0).toFixed(2)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Financeiro (Abaixo) */}
          {(tipo !== 'transacoes_condicionais' || (dadosResumo.observacao?.includes('[PEDIDO]'))) && (
            <div className="space-y-1 pt-2 border-t">
              <h3 className="text-xs font-bold text-gray-700 flex items-center gap-1">
                💳 Financeiro / Parcelas ({parcelas.length})
              </h3>
              <div className="border rounded overflow-x-auto shadow-sm">
                <table className="w-full text-left min-w-[500px]">
                  <thead className="bg-gray-100 border-b">
                    <tr className="text-xs">
                      <th className="px-2 py-1 font-bold text-gray-600 uppercase">Vencimento</th>
                      <th className="px-2 py-1 font-bold text-gray-600 uppercase">Descrição</th>
                      <th className="px-2 py-1 font-bold text-gray-600 uppercase text-right">Valor</th>
                      <th className="px-2 py-1 font-bold text-gray-600 uppercase text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {parcelas.length === 0 ? (
                      <tr><td colSpan={4} className="px-2 py-4 text-center text-gray-400 italic">Vazio</td></tr>
                    ) : (
                      parcelas.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-2 py-1 font-medium text-gray-700">{formatarDataParaExibicao(p.data)}</td>
                          <td className="px-2 py-1 text-gray-600">{p.descricao}</td>
                          <td className="px-2 py-1 text-right font-bold text-gray-900">R$ {p.valor.toFixed(2)}</td>
                          <td className="px-2 py-1 text-center">
                            <span className={`inline-block px-1.5 py-0 rounded text-xs font-bold uppercase ${
                              p.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {parcelas.length > 0 && (
                    <tfoot className="bg-gray-50 font-bold border-t text-xs">
                      <tr>
                        <td colSpan={2} className="px-2 py-1 text-right uppercase">Total:</td>
                        <td className="px-2 py-1 text-right text-green-700">R$ {parcelas.reduce((acc, p) => acc + p.valor, 0).toFixed(2)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-2 bg-gray-50 border-t flex justify-between items-center">
          <div className="flex gap-2">
            {tipo === 'pedidos_loja' && dadosResumo.status !== 'faturado' && dadosResumo.status !== 'cancelado' && (
              <button
                onClick={() => setFaturarAberto(true)}
                className="px-4 py-1.5 bg-green-600 text-white rounded font-bold hover:bg-green-700 transition-all text-xs"
              >
                Faturar
              </button>
            )}
            <button
              onClick={handleEditClick}
              disabled={loadingExcluir || !transacaoFull}
              className="px-4 py-1.5 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition-all text-xs disabled:opacity-50"
            >
              Editar
            </button>
            <button
              onClick={handleExcluir}
              disabled={loadingExcluir}
              className="px-4 py-1.5 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition-all text-xs disabled:opacity-50"
            >
              {loadingExcluir ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 text-white rounded font-bold hover:bg-gray-900 transition-all text-xs"
          >
            Fechar
          </button>
        </div>
      </div>
      {faturarAberto && (
        <ModalFaturarPedido
          aberto={faturarAberto}
          onClose={() => setFaturarAberto(false)}
          onSucesso={handleEditSucesso}
          pedidoId={transacaoId}
        />
      )}
    </div>
  )
}
