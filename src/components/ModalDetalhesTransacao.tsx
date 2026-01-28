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
        {/* Cabeçalho Estilizado conforme print */}
        <div className="bg-[#1a222e] text-white px-6 py-4 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold">
              <span className="text-blue-400">#{dadosResumo.numero}</span> Detalhes da {tipo === 'vendas' ? 'Venda' : tipo === 'compras' ? 'Compra' : 'Transação'}
            </h2>
            <p className="text-xs text-gray-400 mt-1 font-medium">{formatarDataParaExibicao(dadosResumo.data)}</p>
          </div>
          <button onClick={onClose} className="hover:bg-gray-700 p-1.5 rounded transition-colors text-xl">✕</button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Card de Resumo Superior */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Cliente/Fornecedor</p>
              <p className="text-sm font-bold text-gray-900">{dadosResumo.entidade.toUpperCase()}</p>
            </div>
            <div className="space-y-1 flex flex-col items-center md:items-start">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Status</p>
              <span className={`inline-block px-3 py-0.5 rounded text-[11px] font-bold uppercase ${
                dadosResumo.status === 'pago' || dadosResumo.status === 'resolvido'
                  ? 'bg-green-50 text-green-600'
                  : 'bg-yellow-50 text-yellow-600'
              }`}>
                {dadosResumo.status}
              </span>
            </div>
            <div className="space-y-1 text-right md:text-left">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Valor Total</p>
              <p className="text-2xl font-black text-blue-600">R$ {dadosResumo.total.toFixed(2)}</p>
            </div>
          </div>

          {/* Observações (se houver) */}
          {dadosResumo.observacao && (
            <div className="bg-blue-50/50 p-3 rounded border border-blue-100">
              <p className="text-[10px] font-black text-blue-400 uppercase mb-1">Observações</p>
              <p className="text-xs text-gray-700 italic">{dadosResumo.observacao}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Coluna Esquerda: Itens */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span className="text-lg">📦</span> Itens ({itens.length})
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 font-bold text-gray-500 uppercase text-[9px]">Descrição</th>
                      <th className="px-2 py-2 font-bold text-gray-500 uppercase text-[9px] text-center">Qtd</th>
                      <th className="px-2 py-2 font-bold text-gray-500 uppercase text-[9px] text-right">Unitário</th>
                      <th className="px-3 py-2 font-bold text-gray-500 uppercase text-[9px] text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {loading ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic">Buscando itens...</td></tr>
                    ) : itens.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic">Nenhum item encontrado.</td></tr>
                    ) : (
                      itens.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50/50">
                          <td className="px-3 py-2">
                            <p className="font-bold text-gray-800">{item.descricao.toUpperCase()}</p>
                            {item.categoria && <p className="text-[9px] text-gray-400 font-medium">— {item.categoria.toUpperCase()}</p>}
                          </td>
                          <td className="px-2 py-2 text-center text-gray-600 font-medium">{item.quantidade}</td>
                          <td className="px-2 py-2 text-right text-gray-600">R$ {item.preco_unitario.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-bold text-gray-800">R$ {item.subtotal.toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {!loading && itens.length > 0 && (
                    <tfoot className="bg-gray-50/80 font-black border-t border-gray-200">
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-right text-[10px] text-gray-600 uppercase tracking-widest">Total dos Itens:</td>
                        <td className="px-3 py-2 text-right text-blue-600 text-sm italic">R$ {itens.reduce((acc, i) => acc + i.subtotal, 0).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Coluna Direita: Parcelas */}
            {tipo !== 'condicionais' && (
              <div>
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="text-lg">💳</span> Parcelas / Financeiro ({parcelas.length})
                </h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 font-bold text-gray-500 uppercase text-[9px]">Vencimento</th>
                        <th className="px-3 py-2 font-bold text-gray-500 uppercase text-[9px] text-right">Valor</th>
                        <th className="px-3 py-2 font-bold text-gray-500 uppercase text-[9px] text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {parcelas.length === 0 ? (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400 italic">Nenhuma parcela encontrada.</td></tr>
                      ) : (
                        parcelas.map(p => (
                          <tr key={p.id} className="hover:bg-gray-50/50">
                            <td className="px-3 py-2">
                              <p className="text-[11px] text-gray-700 font-bold">{formatarDataParaExibicao(p.data)}</p>
                              <p className="text-[9px] text-gray-400 font-medium italic">{p.descricao}</p>
                            </td>
                            <td className="px-3 py-2 text-right font-black text-gray-800 text-xs whitespace-nowrap">R$ {p.valor.toFixed(2)}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                p.status === 'pago'
                                  ? 'bg-green-50 text-green-600 border border-green-100'
                                  : 'bg-yellow-50 text-yellow-600 border border-yellow-100'
                              }`}>
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {parcelas.length > 0 && (
                      <tfoot className="bg-gray-50/80 font-black border-t border-gray-200">
                        <tr>
                          <td colSpan={1} className="px-3 py-2 text-right text-[10px] text-gray-600 uppercase tracking-widest">Total:</td>
                          <td className="px-3 py-2 text-right text-green-600 text-sm italic">R$ {parcelas.reduce((acc, p) => acc + p.valor, 0).toFixed(2)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-8 py-2 bg-[#1a222e] text-white rounded-lg font-black uppercase tracking-widest text-xs hover:bg-gray-800 transition-all shadow-md"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
