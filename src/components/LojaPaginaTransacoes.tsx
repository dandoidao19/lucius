'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatarDataParaExibicao } from '@/lib/dateUtils'
import ModalTransacaoUnificada from './ModalTransacaoUnificada'
import ModalDetalhesTransacao from './ModalDetalhesTransacao'

interface TransacaoUnificada {
  id: string
  tipo_exibicao: string
  tipo_original: string
  numero: number
  data: string
  entidade: string
  total: number
  status: string
  quantidade_parcelas: number
  observacao: string
  cor: string
  tabela: 'vendas' | 'compras' | 'condicionais'
}

export default function LojaPaginaTransacoes() {
  const [transacoes, setTransacoes] = useState<TransacaoUnificada[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [modalDetalhes, setModalDetalhes] = useState<{ aberto: boolean; transacao: TransacaoUnificada | null }>({
    aberto: false,
    transacao: null
  })

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
          quantidade_parcelas: v.quantidade_parcelas || 1,
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
          quantidade_parcelas: c.quantidade_parcelas || 1,
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
          quantidade_parcelas: 1,
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
              <tr className="text-[10px]">
                <th className="px-1 py-1 font-bold text-gray-600 uppercase whitespace-nowrap">Data</th>
                <th className="px-1 py-1 font-bold text-gray-600 uppercase text-center whitespace-nowrap">Tipo</th>
                <th className="px-1 py-1 font-bold text-gray-600 uppercase text-center">Nº</th>
                <th className="px-1 py-1 font-bold text-gray-600 uppercase min-w-[120px]">Cliente/Fornecedor</th>
                <th className="px-1 py-1 font-bold text-gray-600 uppercase min-w-[200px]">Observações</th>
                <th className="px-1 py-1 font-bold text-gray-600 uppercase text-right whitespace-nowrap">Total</th>
                <th className="px-1 py-1 font-bold text-gray-600 uppercase text-center whitespace-nowrap">Parc.</th>
                <th className="px-1 py-1 font-bold text-gray-600 uppercase text-center whitespace-nowrap">Status</th>
                <th className="px-1 py-1 font-bold text-gray-600 uppercase text-center whitespace-nowrap">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-1 py-4 text-center text-gray-500 text-xs">Carregando transações...</td>
                </tr>
              ) : transacoes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-1 py-4 text-center text-gray-500 text-xs">Nenhuma transação encontrada.</td>
                </tr>
              ) : (
                transacoes.map((t) => (
                  <tr key={`${t.tabela}-${t.id}`} className="hover:bg-gray-50 transition-colors text-[11px]">
                    <td className="px-1 py-0.5 text-gray-700 whitespace-nowrap">{formatarDataParaExibicao(t.data)}</td>
                    <td className="px-1 py-0.5 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black border ${t.cor}`}>
                        {t.tipo_exibicao}
                      </span>
                    </td>
                    <td className="px-1 py-0.5 font-mono text-gray-500 text-center">#{t.numero}</td>
                    <td className="px-1 py-0.5 font-medium text-gray-800 truncate max-w-[150px]" title={t.entidade}>{t.entidade}</td>
                    <td className="px-1 py-0.5 text-gray-500 italic truncate max-w-[250px]" title={t.observacao}>
                      {t.observacao.replace('[PEDIDO]', '').trim() || '—'}
                    </td>
                    <td className="px-1 py-0.5 text-right font-bold text-gray-700 whitespace-nowrap">
                      {t.total > 0 ? `R$ ${t.total.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-1 py-0.5 text-center text-gray-600">{t.quantidade_parcelas}</td>
                    <td className="px-1 py-0.5 text-center uppercase font-semibold">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                        t.status === 'pago' || t.status === 'resolvido' ? 'bg-green-100 text-green-700' :
                        t.status === 'pendente' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-1 py-0.5 text-center">
                      <button
                        onClick={() => setModalDetalhes({ aberto: true, transacao: t })}
                        className="p-1 hover:bg-blue-100 rounded text-blue-600 transition-colors"
                        title="Ver Detalhes"
                      >
                        👁️
                      </button>
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

      {modalDetalhes.transacao && (
        <ModalDetalhesTransacao
          aberto={modalDetalhes.aberto}
          onClose={() => setModalDetalhes({ aberto: false, transacao: null })}
          transacaoId={modalDetalhes.transacao.id}
          tipo={modalDetalhes.transacao.tabela}
          dadosResumo={{
            numero: modalDetalhes.transacao.numero,
            data: modalDetalhes.transacao.data,
            entidade: modalDetalhes.transacao.entidade,
            total: modalDetalhes.transacao.total,
            status: modalDetalhes.transacao.status,
            observacao: modalDetalhes.transacao.observacao
          }}
        />
      )}
    </div>
  )
}
