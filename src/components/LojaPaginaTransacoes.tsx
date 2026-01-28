'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatarDataParaExibicao } from '@/lib/dateUtils'
import ModalTransacaoUnificada from './ModalTransacaoUnificada'

interface TransacaoUnificada {
  id: string
  tipo_exibicao: string
  tipo_original: string
  numero: number
  data: string
  entidade: string
  total: number
  status: string
  observacao: string
  cor: string
  tabela: 'vendas' | 'compras' | 'condicionais'
}

export default function LojaPaginaTransacoes() {
  const [transacoes, setTransacoes] = useState<TransacaoUnificada[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)

  const carregarTransacoes = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Buscar Vendas
      const { data: vendas } = await supabase
        .from('vendas')
        .select('*')
        .order('data_venda', { ascending: false })

      // 2. Buscar Compras
      const { data: compras } = await supabase
        .from('compras')
        .select('*')
        .order('data_compra', { ascending: false })

      // 3. Buscar Condicionais/Pedidos
      const { data: condicionais } = await supabase
        .from('transacoes_condicionais')
        .select('*')
        .order('data_transacao', { ascending: false })

      const unificadas: TransacaoUnificada[] = []

      vendas?.forEach(v => {
        unificadas.push({
          id: v.id,
          tipo_exibicao: 'VENDA',
          tipo_original: 'venda',
          numero: v.numero_transacao,
          data: v.data_venda,
          entidade: v.cliente,
          total: v.total,
          status: v.status_pagamento,
          observacao: v.observacao || '',
          cor: 'bg-green-100 text-green-800 border-green-200',
          tabela: 'vendas'
        })
      })

      compras?.forEach(c => {
        unificadas.push({
          id: c.id,
          tipo_exibicao: 'COMPRA',
          tipo_original: 'compra',
          numero: c.numero_transacao,
          data: c.data_compra,
          entidade: c.fornecedor,
          total: c.total,
          status: c.status_pagamento,
          observacao: c.observacao || '',
          cor: 'bg-blue-100 text-blue-800 border-blue-200',
          tabela: 'compras'
        })
      })

      condicionais?.forEach(cn => {
        const isPedido = cn.observacao?.includes('[PEDIDO]')
        let tipoLabel = ''
        let cor = ''

        if (isPedido) {
          tipoLabel = cn.tipo === 'enviado' ? 'P. VENDA' : 'P. COMPRA'
          cor = cn.tipo === 'enviado' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-orange-100 text-orange-800 border-orange-200'
        } else {
          tipoLabel = cn.tipo === 'enviado' ? 'COND. CLI.' : 'COND. FORN.'
          cor = cn.tipo === 'enviado' ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-indigo-100 text-indigo-800 border-indigo-200'
        }

        unificadas.push({
          id: cn.id,
          tipo_exibicao: tipoLabel,
          tipo_original: cn.tipo,
          numero: cn.numero_transacao,
          data: cn.data_transacao,
          entidade: cn.origem,
          total: 0, // Precisaria somar itens se quisesse total aqui, mas condicionais às vezes não tem preço total gravado
          status: cn.status,
          observacao: cn.observacao || '',
          cor: cor,
          tabela: 'condicionais'
        })
      })

      // Ordenar por data decrescente
      unificadas.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

      setTransacoes(unificadas)
    } catch (err) {
      console.error('Erro ao carregar transações unificadas:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarTransacoes()
  }, [carregarTransacoes])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
        <h2 className="text-lg font-bold text-gray-800">Lista Unificada de Transações</h2>
        <button
          onClick={() => setModalAberto(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-md flex items-center gap-2"
        >
          <span>+</span> Novo Lançamento
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Data</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase text-center">Tipo</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Nº</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Cliente/Fornecedor</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase text-right">Total</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase text-center">Status</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Observações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">Carregando transações...</td>
                </tr>
              ) : transacoes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">Nenhuma transação encontrada.</td>
                </tr>
              ) : (
                transacoes.map((t) => (
                  <tr key={`${t.tabela}-${t.id}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-700">{formatarDataParaExibicao(t.data)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-[10px] font-black border ${t.cor}`}>
                        {t.tipo_exibicao}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-500">#{t.numero}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{t.entidade}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-700">
                      {t.total > 0 ? `R$ ${t.total.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-xs uppercase font-semibold">
                      <span className={`px-2 py-0.5 rounded-full ${
                        t.status === 'pago' || t.status === 'resolvido' ? 'bg-green-100 text-green-700' :
                        t.status === 'pendente' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 italic max-w-xs truncate" title={t.observacao}>
                      {t.observacao.replace('[PEDIDO]', '').trim()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ModalTransacaoUnificada
        aberto={modalAberto}
        onClose={() => setModalAberto(false)}
        onSucesso={carregarTransacoes}
      />
    </div>
  )
}
