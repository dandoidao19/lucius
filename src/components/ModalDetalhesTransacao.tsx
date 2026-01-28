'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatarDataParaExibicao } from '@/lib/dateUtils'

interface ItemDetalhe {
  id: string
  descricao: string
  quantidade: number
  preco_unitario: number
  subtotal: number
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

      const itensFormatados = (data || []).map((item: { id: string; descricao?: string; quantidade?: number; preco_venda?: number; valor_repasse?: number; preco_custo?: number; categoria?: string }) => ({
        id: item.id,
        descricao: item.descricao || '',
        quantidade: item.quantidade || 0,
        preco_unitario: tipo === 'vendas' ? (item.preco_venda || 0) : (item.valor_repasse || item.preco_custo || 0),
        subtotal: (item.quantidade || 0) * (tipo === 'vendas' ? (item.preco_venda || 0) : (item.valor_repasse || item.preco_custo || 0)),
        categoria: item.categoria
      }))

      setItens(itensFormatados)
    } catch (err) {
      console.error('Erro ao buscar itens do detalhamento:', err)
    } finally {
      setLoading(false)
    }
  }, [transacaoId, tipo])

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
      buscarItens()
      buscarParcelas()
    }
  }, [aberto, transacaoId, buscarItens, buscarParcelas])

  if (!aberto) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="bg-gray-800 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="text-blue-400">#{dadosResumo.numero}</span> Detalhes da {tipo === 'vendas' ? 'Venda' : tipo === 'compras' ? 'Compra' : 'Transação'}
            </h2>
            <p className="text-xs text-gray-400">{formatarDataParaExibicao(dadosResumo.data)}</p>
          </div>
          <button onClick={onClose} className="hover:bg-gray-700 p-2 rounded-full transition-colors text-xl">✕</button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase">Cliente/Fornecedor</p>
              <p className="text-sm font-semibold text-gray-800">{dadosResumo.entidade}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase">Status</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                dadosResumo.status === 'pago' || dadosResumo.status === 'resolvido' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {dadosResumo.status.toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase">Valor Total</p>
              <p className="text-lg font-bold text-blue-700">R$ {dadosResumo.total.toFixed(2)}</p>
            </div>
          </div>

          {/* Observações (se houver) */}
          {dadosResumo.observacao && (
            <div className="bg-blue-50 p-3 rounded border border-blue-100">
              <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Observações</p>
              <p className="text-xs text-blue-800 italic">{dadosResumo.observacao}</p>
            </div>
          )}

          {/* Itens (No topo) */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              📦 Itens ({itens.length})
            </h3>
            <div className="border rounded-lg overflow-x-auto shadow-sm">
              <table className="w-full text-xs text-left min-w-[600px]">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-2 font-bold text-gray-600 uppercase">Descrição</th>
                    <th className="px-4 py-2 font-bold text-gray-600 uppercase">Categoria</th>
                    <th className="px-4 py-2 font-bold text-gray-600 uppercase text-center">Qtd</th>
                    <th className="px-4 py-2 font-bold text-gray-600 uppercase text-right">Unitário</th>
                    <th className="px-4 py-2 font-bold text-gray-600 uppercase text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {loading ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500 italic">Buscando itens...</td></tr>
                  ) : itens.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500 italic">Nenhum item encontrado.</td></tr>
                  ) : (
                    itens.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-800">{item.descricao}</td>
                        <td className="px-4 py-2 text-gray-600">{item.categoria || '—'}</td>
                        <td className="px-4 py-2 text-center">{item.quantidade}</td>
                        <td className="px-4 py-2 text-right">R$ {item.preco_unitario.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right font-bold text-gray-900">R$ {item.subtotal.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {!loading && itens.length > 0 && (
                  <tfoot className="bg-gray-50 font-bold border-t">
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-right uppercase text-[10px]">Total dos Itens:</td>
                      <td className="px-4 py-2 text-right text-blue-700 font-bold">R$ {itens.reduce((acc, i) => acc + i.subtotal, 0).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Financeiro (Abaixo) */}
          {tipo !== 'condicionais' && (
            <div className="space-y-2 pt-4 border-t">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                💳 Detalhamento Financeiro / Parcelas ({parcelas.length})
              </h3>
              <div className="border rounded-lg overflow-x-auto shadow-sm">
                <table className="w-full text-xs text-left min-w-[600px]">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-2 font-bold text-gray-600 uppercase">Vencimento</th>
                      <th className="px-4 py-2 font-bold text-gray-600 uppercase">Descrição</th>
                      <th className="px-4 py-2 font-bold text-gray-600 uppercase text-right">Valor</th>
                      <th className="px-4 py-2 font-bold text-gray-600 uppercase text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {parcelas.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500 italic">Nenhuma parcela encontrada.</td></tr>
                    ) : (
                      parcelas.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-gray-700">{formatarDataParaExibicao(p.data)}</td>
                          <td className="px-4 py-2 text-gray-600">{p.descricao}</td>
                          <td className="px-4 py-2 text-right font-bold text-gray-900">R$ {p.valor.toFixed(2)}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
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
                    <tfoot className="bg-gray-50 font-bold border-t">
                      <tr>
                        <td colSpan={2} className="px-4 py-2 text-right uppercase text-[10px]">Total:</td>
                        <td className="px-4 py-2 text-right text-green-700 font-bold">R$ {parcelas.reduce((acc, p) => acc + p.valor, 0).toFixed(2)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-800 text-white rounded-lg font-bold hover:bg-gray-900 transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
