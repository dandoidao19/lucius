'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatarDataParaExibicao } from '@/lib/dateUtils'
import ModalTransacaoUnificada from './ModalTransacaoUnificada'
import ModalDetalhesTransacao from './ModalDetalhesTransacao'
import FiltrosTransacoes from './FiltrosTransacoes'
import { GeradorPDFLancamentos } from '@/lib/gerador-pdf-lancamentos'

interface TransacaoUnificada {
  id: string
  tipo_exibicao: string
  tipo_slug: string // Para filtros
  tipo_original: string
  numero: number
  data: string
  entidade: string
  total: number
  status: string
  quantidade_parcelas: number
  quantidade_itens: number
  observacao: string
  cor: string
  tabela: 'vendas' | 'compras' | 'condicionais'
}

export default function LojaPaginaTransacoes() {
  const [transacoes, setTransacoes] = useState<TransacaoUnificada[]>([])
  const [transacoesFiltradas, setTransacoesFiltradas] = useState<TransacaoUnificada[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [modalDetalhes, setModalDetalhes] = useState<{ aberto: boolean; transacao: TransacaoUnificada | null }>({
    aberto: false,
    transacao: null
  })

  // Estados de Filtro
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroNumero, setFiltroNumero] = useState('')
  const [filtroEntidade, setFiltroEntidade] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')

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

      // 3. Buscar Condicionais/Pedidos com contagem de itens
      const { data: condicionais } = await supabase
        .from('transacoes_condicionais')
        .select(`
          *,
          itens_condicionais (count)
        `)
        .order('data_transacao', { ascending: false })

      const unificadas: TransacaoUnificada[] = []

      vendas?.forEach(v => {
        unificadas.push({
          id: v.id,
          tipo_exibicao: 'VENDA',
          tipo_slug: 'venda',
          tipo_original: 'venda',
          numero: v.numero_transacao,
          data: v.data_venda,
          entidade: v.cliente,
          total: v.total,
          status: v.status_pagamento,
          quantidade_parcelas: v.quantidade_parcelas || 1,
          quantidade_itens: v.quantidade_itens || 0,
          observacao: v.observacao || '',
          cor: 'bg-green-600 text-white shadow-sm',
          tabela: 'vendas'
        })
      })

      compras?.forEach(c => {
        unificadas.push({
          id: c.id,
          tipo_exibicao: 'COMPRA',
          tipo_slug: 'compra',
          tipo_original: 'compra',
          numero: c.numero_transacao,
          data: c.data_compra,
          entidade: c.fornecedor,
          total: c.total,
          status: c.status_pagamento,
          quantidade_parcelas: c.quantidade_parcelas || 1,
          quantidade_itens: c.quantidade_itens || 0,
          observacao: c.observacao || '',
          cor: 'bg-blue-600 text-white shadow-sm',
          tabela: 'compras'
        })
      })

      condicionais?.forEach(cn => {
        const isPedido = cn.observacao?.includes('[PEDIDO]')
        let tipoLabel = ''
        let tipoSlug = ''
        let cor = ''

        if (isPedido) {
          tipoLabel = cn.tipo === 'enviado' ? 'P. VENDA' : 'P. COMPRA'
          tipoSlug = cn.tipo === 'enviado' ? 'pedido_venda' : 'pedido_compra'
          cor = cn.tipo === 'enviado' ? 'bg-yellow-500 text-white shadow-sm' : 'bg-orange-500 text-white shadow-sm'
        } else {
          tipoLabel = cn.tipo === 'enviado' ? 'COND. CLI.' : 'COND. FORN.'
          tipoSlug = cn.tipo === 'enviado' ? 'condicional_cliente' : 'condicional_fornecedor'
          cor = cn.tipo === 'enviado' ? 'bg-purple-600 text-white shadow-sm' : 'bg-indigo-600 text-white shadow-sm'
        }

        unificadas.push({
          id: cn.id,
          tipo_exibicao: tipoLabel,
          tipo_slug: tipoSlug,
          tipo_original: cn.tipo,
          numero: cn.numero_transacao,
          data: cn.data_transacao,
          entidade: cn.origem,
          total: 0,
          status: cn.status,
          quantidade_parcelas: 1,
          quantidade_itens: cn.itens_condicionais?.[0]?.count || 0,
          observacao: cn.observacao || '',
          cor: cor,
          tabela: 'condicionais'
        })
      })

      // Ordenar por data decrescente
      unificadas.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

      setTransacoes(unificadas)
      setTransacoesFiltradas(unificadas)
    } catch (err) {
      console.error('Erro ao carregar transações unificadas:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarTransacoes()
  }, [carregarTransacoes])

  const aplicarFiltros = useCallback(() => {
    let result = [...transacoes]

    if (filtroDataInicio) result = result.filter(t => t.data >= filtroDataInicio)
    if (filtroDataFim) result = result.filter(t => t.data <= filtroDataFim)
    if (filtroNumero) result = result.filter(t => t.numero.toString().includes(filtroNumero))
    if (filtroEntidade) result = result.filter(t => t.entidade.toLowerCase().includes(filtroEntidade.toLowerCase()))
    if (filtroTipo !== 'todos') result = result.filter(t => t.tipo_slug === filtroTipo)
    if (filtroStatus !== 'todos') result = result.filter(t => t.status === filtroStatus)

    setTransacoesFiltradas(result)
  }, [transacoes, filtroDataInicio, filtroDataFim, filtroNumero, filtroEntidade, filtroTipo, filtroStatus])

  useEffect(() => {
    aplicarFiltros()
  }, [aplicarFiltros])

  const limparFiltros = () => {
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setFiltroNumero('')
    setFiltroEntidade('')
    setFiltroTipo('todos')
    setFiltroStatus('todos')
  }

  const gerarPDF = () => {
    try {
      const gerador = new GeradorPDFLancamentos()
      const dadosPDF = transacoesFiltradas.map(t => ({
        data: t.data,
        entidade: t.entidade,
        numero: t.numero,
        tipo: t.tipo_exibicao,
        total: t.total,
        status: t.status,
        itens: t.quantidade_itens
      }))

      // Gambiarra técnica para usar o gerador existente adaptado
      const lancamentosAdaptados = dadosPDF.map(d => ({
        data_lancamento: d.data,
        cliente_fornecedor: d.entidade,
        numero_transacao: d.numero,
        tipo: d.tipo,
        total: d.total,
        status: d.status,
        parcelas: `${d.itens} itens`
      }))

      gerador.gerarPDFTransacoesLoja(lancamentosAdaptados, 'Relatório Unificado de Transações')
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      alert('Erro ao gerar PDF')
    }
  }

  return (
    <div className="space-y-2">
      <FiltrosTransacoes
        filtroDataInicio={filtroDataInicio}
        setFiltroDataInicio={setFiltroDataInicio}
        filtroDataFim={filtroDataFim}
        setFiltroDataFim={setFiltroDataFim}
        filtroNumero={filtroNumero}
        setFiltroNumero={setFiltroNumero}
        filtroEntidade={filtroEntidade}
        setFiltroEntidade={setFiltroEntidade}
        filtroTipo={filtroTipo}
        setFiltroTipo={setFiltroTipo}
        filtroStatus={filtroStatus}
        setFiltroStatus={setFiltroStatus}
        onLimpar={limparFiltros}
        onGerarPDF={gerarPDF}
      />

      <div className="flex justify-between items-center bg-pink-700 px-3 py-1 rounded shadow-sm border border-pink-800 text-white">
        <h2 className="text-xs font-semibold uppercase tracking-widest">Transações Unificadas ({transacoesFiltradas.length})</h2>
        <button
          onClick={() => setModalAberto(true)}
          className="bg-white text-pink-700 hover:bg-pink-50 px-3 py-0.5 rounded text-[10px] font-semibold uppercase transition-all shadow-sm flex items-center gap-1"
        >
          <span>+</span> NOVO LANÇAMENTO
        </button>
      </div>

      <div className="bg-white rounded shadow-sm overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-pink-700 text-white border-b border-pink-800">
              <tr>
                <th className="px-1 py-1 font-semibold uppercase w-[85px]">Data</th>
                <th className="px-1 py-1 font-semibold uppercase text-center w-[85px]">Tipo</th>
                <th className="px-0.5 py-1 font-semibold uppercase text-center w-[45px]">Nº</th>
                <th className="px-1 py-1 font-semibold uppercase min-w-[90px]">Cliente/Fornecedor</th>
                <th className="px-1 py-1 font-semibold uppercase min-w-[150px]">Observações</th>
                <th className="px-0.5 py-1 font-semibold uppercase text-right w-[60px]">Total</th>
                <th className="px-0.5 py-1 font-semibold uppercase text-center w-[30px]">Parc.</th>
                <th className="px-0.5 py-1 font-semibold uppercase text-center w-[30px]">Itens</th>
                <th className="px-0.5 py-1 font-semibold uppercase text-center w-[65px]">Status</th>
                <th className="px-0.5 py-1 font-semibold uppercase text-center w-[35px]">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-1 py-4 text-center text-gray-500">Carregando transações...</td>
                </tr>
              ) : transacoesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-1 py-4 text-center text-gray-500">Nenhuma transação encontrada.</td>
                </tr>
              ) : (
                transacoesFiltradas.map((t) => (
                  <tr key={`${t.tabela}-${t.id}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-1 py-1 text-gray-700 whitespace-nowrap">{formatarDataParaExibicao(t.data)}</td>
                    <td className="px-1 py-1 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded font-semibold text-[10px] leading-tight uppercase ${t.cor}`}>
                        {t.tipo_exibicao}
                      </span>
                    </td>
                    <td className="px-0.5 py-1 text-gray-500 text-center">#{t.numero}</td>
                    <td className="px-1 py-1 text-gray-800 truncate max-w-[140px]" title={t.entidade}>{t.entidade}</td>
                    <td className="px-1 py-1 text-gray-500 italic truncate max-w-[350px]" title={t.observacao}>
                      {t.observacao.replace('[PEDIDO]', '').trim() || '—'}
                    </td>
                    <td className="px-0.5 py-1 text-right font-semibold text-gray-700 whitespace-nowrap">
                      {t.total > 0 ? `R$ ${t.total.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-0.5 py-1 text-center text-gray-600">{t.quantidade_parcelas}</td>
                    <td className="px-0.5 py-1 text-center text-gray-600 font-semibold">{t.quantidade_itens}</td>
                    <td className="px-0.5 py-1 text-center uppercase">
                      <span className={`px-1 py-0.5 rounded font-semibold ${
                        t.status === 'pago' || t.status === 'resolvido' ? 'bg-green-600 text-white' :
                        t.status === 'pendente' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {t.status === 'pago' ? 'PAGO' : t.status === 'resolvido' ? 'RESOLVIDO' : t.status}
                      </span>
                    </td>
                    <td className="px-1 py-1 text-center">
                      <button
                        onClick={() => setModalDetalhes({ aberto: true, transacao: t })}
                        className="p-1 hover:bg-purple-100 rounded text-purple-600 transition-colors"
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
