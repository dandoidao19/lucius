'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatarDataParaExibicao } from '@/lib/dateUtils'
import ModalTransacaoUnificada from './ModalTransacaoUnificada'

interface ItemDetalhe {
  id: string
  produto_id: string | null
  descricao: string
  quantidade: number
  preco_venda: number
  preco_custo: number
  valor_repasse: number
  categoria?: string
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
  transacaoId: string
  tipo: 'vendas' | 'compras' | 'condicionais'
  dadosResumo: {
    numero: number
    data: string
    entidade: string
    total: number
    status: string
    observacao: string
  }
}

export default function ModalDetalhesTransacao({ aberto, onClose, transacaoId, tipo, dadosResumo }: ModalDetalhesTransacaoProps) {
  const [itens, setItens] = useState<ItemDetalhe[]>([])
  const [parcelas, setParcelas] = useState<ParcelaDetalhe[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingExcluir, setLoadingExcluir] = useState(false)
  const [transacaoFull, setTransacaoFull] = useState<any>(null)
  const [editAberto, setEditAberto] = useState(false)

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
        'itens_condicionais'
      ).select('*')

      if (tipo === 'vendas') query = query.eq('venda_id', transacaoId)
      else if (tipo === 'compras') query = query.eq('compra_id', transacaoId)
      else query = query.eq('transacao_id', transacaoId)

      const { data, error } = await query

      if (error) throw error

      const itensFormatados = (data || []).map((item: Record<string, unknown>) => ({
        id: (item.id as string),
        produto_id: (item.produto_id as string | null),
        descricao: (item.descricao as string) || '',
        quantidade: (item.quantidade as number) || 0,
        preco_venda: (item.preco_venda as number) || 0,
        preco_custo: (item.preco_custo as number) || 0,
        valor_repasse: (item.valor_repasse as number) || 0,
        categoria: (item.categoria as string)
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
        const { data: prod } = await supabase
          .from('produtos')
          .select('id')
          .ilike('descricao', item.descricao)
          .single()

        if (prod) {
          const multiplicador = tipo === 'vendas' ? 1 : -1 // Venda: devolve pro estoque. Compra: retira do estoque.
          await supabase.rpc('atualizar_estoque', {
            produto_id_param: prod.id,
            quantidade_param: item.quantidade * multiplicador
          })

          await supabase.from('movimentacoes_estoque').insert({
            produto_id: prod.id,
            tipo: tipo === 'vendas' ? 'entrada' : 'saida',
            quantidade: item.quantidade,
            observacao: `EXTORNO/EXCLUSÃO: #${dadosResumo.numero} (${tipo})`
          })
        }
      }

      // 2. Deletar Financeiro (transacoes_loja)
      // Buscamos pelo prefixo e numero na descricao ou algo mais seguro
      // Infelizmente não temos o ID da transação vinculado diretamente em cada parcela de forma fácil sem uma coluna extra.
      // Mas podemos usar a lógica de busca que já usamos no buscarParcelas.
      const prefixo = tipo === 'vendas' ? 'Venda' : 'Compra'
      if (tipo !== 'condicionais') {
        const { data: parcelasLoja } = await supabase
          .from('transacoes_loja')
          .select('id')
          .ilike('descricao', `${prefixo}%${dadosResumo.entidade}%`)

        if (parcelasLoja && parcelasLoja.length > 0) {
          const ids = parcelasLoja.map(p => p.id)
          await supabase.from('transacoes_loja').delete().in('id', ids)
        }
      }

      // 3. Deletar a Transação Principal e Itens
      if (tipo === 'vendas') {
        await supabase.from('itens_venda').delete().eq('venda_id', transacaoId)
        await supabase.from('vendas').delete().eq('id', transacaoId)
      } else if (tipo === 'compras') {
        await supabase.from('itens_compra').delete().eq('compra_id', transacaoId)
        await supabase.from('compras').delete().eq('id', transacaoId)
      } else {
        await supabase.from('itens_condicionais').delete().eq('transacao_id', transacaoId)
        await supabase.from('transacoes_condicionais').delete().eq('id', transacaoId)
      }

      alert('✅ Transação excluída com sucesso!')
      onClose()
      window.location.reload() // Recarrega para atualizar as listas
    } catch (err) {
      console.error('Erro ao excluir transação:', err)
      alert('❌ Erro ao excluir transação')
    } finally {
      setLoadingExcluir(false)
    }
  }

  const buscarParcelas = useCallback(async () => {
    if (tipo === 'condicionais') {
      setParcelas([])
      return
    }

    try {
      const prefixo = tipo === 'vendas' ? 'Venda' : 'Compra'

      // Busca parcelas que contenham o nome da entidade na descrição
      const { data, error } = await supabase
        .from('transacoes_loja')
        .select('*')
        .ilike('descricao', `${prefixo}%${dadosResumo.entidade}%`)
        .order('data', { ascending: true })

      if (error) throw error

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
  }, [tipo, dadosResumo.entidade])

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
    onClose()
    window.location.reload()
  }

  if (editAberto && transacaoFull) {
    const isPedido = transacaoFull.observacao?.includes('[PEDIDO]')
    let tipoMapeado = ''
    if (tipo === 'vendas') tipoMapeado = 'venda'
    else if (tipo === 'compras') tipoMapeado = 'compra'
    else {
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
      data: (tipo === 'vendas' ? transacaoFull.data_venda : (tipo === 'compras' ? transacaoFull.data_compra : transacaoFull.data_transacao)) as string,
      entidade: (tipo === 'vendas' ? transacaoFull.cliente : (tipo === 'compras' ? transacaoFull.fornecedor : transacaoFull.origem)) as string,
      total: (transacaoFull.total as number) || 0,
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
              <span className="text-blue-400">#{dadosResumo.numero}</span> Detalhes da {tipo === 'vendas' ? 'Venda' : tipo === 'compras' ? 'Compra' : 'Transação'}
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
                dadosResumo.status === 'pago' || dadosResumo.status === 'resolvido' ? 'bg-green-600 text-white' : 'bg-yellow-500 text-white'
              }`}>
                {dadosResumo.status.toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Total</p>
              <p className="text-sm font-black text-purple-700">R$ {dadosResumo.total.toFixed(2)}</p>
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
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {loading ? (
                    <tr><td colSpan={5} className="px-2 py-4 text-center text-gray-400 italic">Buscando...</td></tr>
                  ) : itens.length === 0 ? (
                    <tr><td colSpan={5} className="px-2 py-4 text-center text-gray-400 italic">Vazio</td></tr>
                  ) : (
                    itens.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-2 py-1 font-medium text-gray-800">{item.descricao}</td>
                        <td className="px-2 py-1 text-gray-600">{item.categoria || '—'}</td>
                        <td className="px-2 py-1 text-center">{item.quantidade}</td>
                        <td className="px-2 py-1 text-right">R$ {(tipo === 'vendas' ? item.preco_venda : item.valor_repasse).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right font-bold text-gray-900">R$ {(item.quantidade * (tipo === 'vendas' ? item.preco_venda : item.valor_repasse)).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {!loading && itens.length > 0 && (
                  <tfoot className="bg-purple-50 font-bold border-t text-xs">
                    <tr>
                      <td colSpan={4} className="px-2 py-1 text-right uppercase">Total Itens:</td>
                      <td className="px-2 py-1 text-right text-purple-700">R$ {itens.reduce((acc, i) => acc + (i.quantidade * (tipo === 'vendas' ? i.preco_venda : i.valor_repasse)), 0).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Financeiro (Abaixo) */}
          {tipo !== 'condicionais' && (
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
    </div>
  )
}
