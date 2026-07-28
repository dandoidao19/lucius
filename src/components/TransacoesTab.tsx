/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useLancamentosFinanceiros } from '@/hooks/useLancamentosFinanceiros'
import { LancamentoFinanceiro, useDadosFinanceiros } from '@/context/DadosFinanceirosContext'
import { getDataAtualBrasil, formatarDataParaExibicao } from '@/lib/dateUtils'
import { useCentrosDeCusto } from '@/hooks/useCentrosDeCusto'
import ModalPagarAvancado from '@/components/ModalPagarAvancado'
import ModalLancamentoCasa from '@/components/ModalLancamentoCasa'
import { GeradorPDFLancamentos } from '@/lib/gerador-pdf-lancamentos'
import { PencilLine, Trash2, CreditCard } from 'lucide-react'

interface ModalPagarState {
  aberto: boolean
  lancamento: LancamentoFinanceiro | null
  passo: 'inicial' | 'valor' | 'decisao' | 'nova_data'
  valorPago: number | null
  dataPagamento: string
  novaDataVencimento: string
  pagarTotal: boolean
}

const estadoInicialModal: ModalPagarState = {
  aberto: false,
  lancamento: null,
  passo: 'inicial',
  valorPago: null,
  dataPagamento: getDataAtualBrasil(),
  novaDataVencimento: getDataAtualBrasil(),
  pagarTotal: true,
}

export default function TransacoesTab() {
  const { data: lancamentos = [], isLoading } = useLancamentosFinanceiros()
  const { data: centrosCusto = [] } = useCentrosDeCusto()
  const queryClient = useQueryClient()
  const { triggerRefresh } = useDadosFinanceiros()

  const [expandirPeriodo, setExpandirPeriodo] = useState(false)
  // Padrão histórico: "Próx. 10 dias"
  const [filtrosRapidos, setFiltrosRapidos] = useState({ proximo10: true, abertos: false, tudo: false })
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [buscaDescricao, setBuscaDescricao] = useState('')
  const [cdcSelecionadoId, setCdcSelecionadoId] = useState('')
  const [modalPagar, setModalPagar] = useState<ModalPagarState>(estadoInicialModal)
  const [pagamentoLoading, setPagamentoLoading] = useState(false)

  const [modalCasaAberto, setModalCasaAberto] = useState(false)
  const [lancamentoEdicao, setLancamentoEdicao] = useState<LancamentoFinanceiro | null>(null)

  const formatarMoeda = (valor: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)

  const getDataNDias = (dias: number) => {
    const hoje = new Date()
    const data = new Date(hoje.getTime() + dias * 24 * 60 * 60 * 1000)
    return data.toISOString().split('T')[0]
  }

  const getStatusVisual = (lancamento: LancamentoFinanceiro) => {
    if (lancamento.status === 'realizado') {
      return { label: 'Pago', cor: 'bg-green-500', textoCor: 'text-white' }
    }
    return { label: 'Pendente', cor: 'bg-gray-500', textoCor: 'text-white' }
  }

  const atualizarCacheLancamentos = (updater: (atuais: LancamentoFinanceiro[]) => LancamentoFinanceiro[]) => {
    queryClient.setQueryData<LancamentoFinanceiro[]>(['lancamentos_financeiros'], atuais => updater(atuais ?? []))
  }

  const handleExcluir = async (lancamento: LancamentoFinanceiro) => {
    if (!confirm(`Tem certeza que deseja excluir "${lancamento.descricao}"?`)) return

    try {
      const { error } = await supabase
        .from('lancamentos_financeiros')
        .delete()
        .eq('id', lancamento.id)

      if (error) throw error

      atualizarCacheLancamentos(atuais => atuais.filter(item => item.id !== lancamento.id))
      queryClient.invalidateQueries({ queryKey: ['lancamentos_financeiros'] })
      triggerRefresh()
      alert('✅ Transação excluída com sucesso!')
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('Erro ao excluir:', error)
      alert('❌ Erro ao excluir transação: ' + msg)
    }
  }

  const transacoesFiltradas = useMemo(() => {
    const hoje = getDataAtualBrasil()
    const data10Dias = getDataNDias(10)
    const { proximo10, abertos, tudo } = filtrosRapidos

    return lancamentos.filter(l => {
      const dataPrevista = l.data_prevista || l.data
      const dataBase = dataPrevista.split('T')[0]
      const isOpen = l.status !== 'realizado'
      const within10 = (dataBase >= hoje && dataBase <= data10Dias) || (dataBase < hoje && isOpen)

      let atendeFiltro = true
      if (tudo && abertos) {
        atendeFiltro = isOpen
      } else if (tudo) {
        atendeFiltro = true
      } else if (proximo10 && abertos) {
        atendeFiltro = within10 && isOpen
      } else if (proximo10) {
        atendeFiltro = within10
      } else if (abertos) {
        atendeFiltro = isOpen
      } else {
        atendeFiltro = within10
      }

      const buscaLower = buscaDescricao.trim().toLowerCase()
      const atendeDescricao =
        !buscaLower || String(l.descricao ?? '').toLowerCase().includes(buscaLower)

      const atendeCdc =
        !cdcSelecionadoId || String(l.centro_custo_id ?? '') === String(cdcSelecionadoId)

      const atendePeriodo =
        (!dataInicio || dataBase >= dataInicio) &&
        (!dataFim || dataBase <= dataFim)

      return atendeFiltro && atendePeriodo && atendeDescricao && atendeCdc
    })
  }, [lancamentos, filtrosRapidos, dataInicio, dataFim, buscaDescricao, cdcSelecionadoId])

  const transacoesAgrupadas = useMemo(() => {
    const grupos: Record<string, LancamentoFinanceiro[]> = {}

    transacoesFiltradas.forEach(t => {
      const data = (t.status === 'realizado' ? t.data_lancamento : t.data_prevista) || t.data
      const dataParte = data.split('T')[0]

      if (!grupos[dataParte]) {
        grupos[dataParte] = []
      }
      grupos[dataParte].push(t)
    })

    return Object.entries(grupos)
      .map(([data, transacoes]) => ({ data, transacoes }))
      .sort((a, b) => a.data.localeCompare(b.data))
  }, [transacoesFiltradas])

  const totalDia = (transacoes: LancamentoFinanceiro[]) =>
    transacoes.reduce((sum, lanc) => sum + (lanc.tipo === 'entrada' ? lanc.valor : -lanc.valor), 0)

  const alternarFiltroRapido = (nome: 'proximo10' | 'abertos' | 'tudo') => {
    setFiltrosRapidos(prev => ({ ...prev, [nome]: !prev[nome] }))
  }

  const handleLimparPeriodo = () => {
    setDataInicio('')
    setDataFim('')
  }

  const abrirModalPagar = (lancamento: LancamentoFinanceiro) => {
    setModalPagar({
      aberto: true,
      lancamento,
      passo: 'inicial',
      valorPago: null,
      dataPagamento: getDataAtualBrasil(),
      novaDataVencimento: getDataAtualBrasil(),
      pagarTotal: true,
    })
  }

  const processarPagamento = async (criarNovaParcela: boolean = false) => {
    if (!modalPagar.lancamento) return
    if (pagamentoLoading) return

    setPagamentoLoading(true)

    try {
      const lance = modalPagar.lancamento
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData?.session?.user?.id

      const valorOriginal = lance.valor
      const valorPagoFinal = modalPagar.valorPago !== null ? modalPagar.valorPago : valorOriginal
      const valorRestante = Math.max(0, valorOriginal - valorPagoFinal)
      const descricaoBase = lance.descricao.replace(/\s*\(\d+\/\d+\)\s*$/, '')
      const descricaoAtualizada = lance.descricao

      const { error: errorUpdate } = await supabase
        .from('lancamentos_financeiros')
        .update({
          status: 'realizado',
          valor: valorPagoFinal,
          data_lancamento: modalPagar.dataPagamento,
          data_prevista: modalPagar.dataPagamento,
          descricao: descricaoAtualizada,
        })
        .eq('id', lance.id)

      if (errorUpdate) throw errorUpdate

      if (criarNovaParcela && valorRestante > 0.01) {
        const novaDescricao = `${descricaoBase} (${valorRestante.toFixed(2)})`
        const dadosNovaParcela: any = {
          descricao: novaDescricao,
          valor: valorRestante,
          tipo: lance.tipo,
          centro_custo_id: lance.centro_custo_id,
          data_lancamento: modalPagar.novaDataVencimento,
          data_prevista: modalPagar.novaDataVencimento,
          status: 'previsto',
          caixa_id: lance.caixa_id,
          origem: lance.origem,
        }

        if (userId) {
          dadosNovaParcela.user_id = userId
        }

        const { data: novaParcelaInserida, error: errorInsert } = await supabase
          .from('lancamentos_financeiros')
          .insert([dadosNovaParcela])
          .select('*, centros_de_custo(nome)')
          .single()

        if (errorInsert) throw errorInsert
        if (novaParcelaInserida) {
          atualizarCacheLancamentos(atuais => [novaParcelaInserida as LancamentoFinanceiro, ...atuais])
        }
      }

      atualizarCacheLancamentos(atuais =>
        atuais.map(item =>
          item.id === lance.id
            ? {
                ...item,
                status: 'realizado',
                valor: valorPagoFinal,
                data_lancamento: modalPagar.dataPagamento,
                data_prevista: modalPagar.dataPagamento,
                descricao: descricaoAtualizada,
              }
            : item
        )
      )
      queryClient.invalidateQueries({ queryKey: ['lancamentos_financeiros'] })
      triggerRefresh()
      setModalPagar(estadoInicialModal)
      alert('✅ Pagamento registrado com sucesso!')
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('Erro ao processar pagamento:', error)
      alert('❌ Erro ao processar pagamento: ' + msg)
    } finally {
      setPagamentoLoading(false)
    }
  }

  const abrirModalEditar = (transacao: LancamentoFinanceiro) => {
    setLancamentoEdicao(transacao)
    setModalCasaAberto(true)
  }

  const handleNovoLancamento = () => {
    setLancamentoEdicao(null)
    setModalCasaAberto(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Carregando transações...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-120px)] flex-col overflow-hidden px-0 lg:min-h-0">
      <ModalPagarAvancado
        modalPagar={modalPagar}
        setModalPagar={setModalPagar}
        processarPagamento={processarPagamento}
      />

      <ModalLancamentoCasa
        aberto={modalCasaAberto}
        lancamentoEdicao={lancamentoEdicao}
        onClose={() => {
          setModalCasaAberto(false)
          setLancamentoEdicao(null)
        }}
      />

      <div className="flex-none border border-gray-300 rounded-lg overflow-hidden z-30 bg-white shadow-sm">
        <div className="p-2 space-y-2 bg-white">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={handleNovoLancamento}
                className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-md text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                + Novo Lançamento
              </button>
              <button
                onClick={() => setExpandirPeriodo(!expandirPeriodo)}
                className="bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-md text-xs font-semibold transition-colors"
              >
                {expandirPeriodo ? 'Ocultar' : 'Abrir'} filtros
              </button>
            </div>
          </div>

          {expandirPeriodo && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => alternarFiltroRapido('proximo10')}
                  className={`py-1 px-1.5 rounded text-[11px] font-semibold transition-colors ${
                    filtrosRapidos.proximo10
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100'
                  }`}
                >
                  Próx. 10d
                </button>
                <button
                  onClick={() => alternarFiltroRapido('abertos')}
                  className={`py-1 px-1.5 rounded text-[11px] font-semibold transition-colors ${
                    filtrosRapidos.abertos
                      ? 'bg-orange-600 text-white'
                      : 'bg-orange-50 text-orange-700 border border-orange-300 hover:bg-orange-100'
                  }`}
                >
                  Abertos
                </button>
                <button
                  onClick={() => alternarFiltroRapido('tudo')}
                  className={`py-1 px-1.5 rounded text-[11px] font-semibold transition-colors ${
                    filtrosRapidos.tudo
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-50 text-purple-700 border border-purple-300 hover:bg-purple-100'
                  }`}
                >
                  Tudo
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-700 mb-0.5">Início</label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-700 mb-0.5">Fim</label>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-700 mb-0.5">Descrição</label>
                  <input
                    type="text"
                    value={buscaDescricao}
                    onChange={(e) => setBuscaDescricao(e.target.value)}
                    placeholder="Buscar..."
                    className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-700 mb-0.5">CDC</label>
                  <select
                    value={cdcSelecionadoId}
                    onChange={(e) => setCdcSelecionadoId(e.target.value)}
                    className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs"
                  >
                    <option value="">Todos</option>
                    {centrosCusto.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  onClick={handleLimparPeriodo}
                  className="flex-1 py-1 rounded text-[11px] font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Limpar período
                </button>
                <button
                  onClick={() => {
                    if (transacoesFiltradas.length === 0) {
                      alert('❌ Nenhuma transação encontrada para gerar PDF com os filtros aplicados')
                      return
                    }
                    const gerador = new GeradorPDFLancamentos()
                    gerador.gerarPDFLancamentosCasa(transacoesFiltradas, centrosCusto)
                  }}
                  className="flex-1 py-1 rounded text-[11px] font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  📄 Gerar PDF
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-1.5 flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
      {transacoesAgrupadas.length === 0 ? (
        <div className="text-center py-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-xs">Nenhuma transação encontrada para este filtro.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {transacoesAgrupadas.map(grupo => {
            const saldoDia = totalDia(grupo.transacoes)
            return (
              <div key={grupo.data} className="rounded-lg border border-slate-200 bg-slate-200 p-1.5 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-xs font-bold text-slate-900 truncate leading-tight">{formatarDataParaExibicao(grupo.data)}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-600">
                    <span className="font-semibold text-slate-900">{grupo.transacoes.length} transação{grupo.transacoes.length !== 1 ? 's' : ''}</span>
                    <span className={`font-bold ${saldoDia >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {saldoDia >= 0 ? '↑' : '↓'} {formatarMoeda(Math.abs(saldoDia))}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  {grupo.transacoes.map(transacao => {
                    const status = getStatusVisual(transacao)
                    const nomeCDC = (transacao as any).centros_de_custo?.nome || transacao.centro_custo_id || '-'

                    return (
                      <div
                        key={transacao.id}
                        className={`rounded-md bg-white px-2 py-1.5 shadow-sm border-l-4 ${
                          transacao.tipo === 'entrada'
                            ? 'border-l-green-600 border-t border-r border-b border-gray-200'
                            : 'border-l-red-600 border-t border-r border-b border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-slate-900 truncate flex-1 leading-tight">{transacao.descricao}</p>
                          <span className={`text-xs font-bold whitespace-nowrap ${transacao.tipo === 'entrada' ? 'text-emerald-700' : 'text-red-700'}`}>
                            {transacao.tipo === 'entrada' ? '↑' : '↓'} <span className={transacao.tipo === 'entrada' ? 'text-emerald-700' : 'text-red-700'}>{formatarMoeda(transacao.valor)}</span>
                          </span>
                        </div>

                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500 flex-wrap">
                          <span className="truncate flex-1 text-slate-700">{nomeCDC}</span>
                          <span className={`${status.cor} ${status.textoCor} px-1.5 py-0.5 rounded-full font-semibold leading-tight`}>{status.label}</span>

                          {transacao.status !== 'realizado' && (
                            <button
                              onClick={() => abrirModalPagar(transacao)}
                              className="inline-flex items-center justify-center w-7 h-7 lg:w-6 lg:h-6 rounded-md bg-white border border-gray-200 text-blue-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                              aria-label="Pagar"
                              title="Pagar"
                            >
                              <CreditCard size={14} />
                            </button>
                          )}

                          <button
                            onClick={() => handleExcluir(transacao)}
                            className="inline-flex items-center justify-center w-7 h-7 lg:w-6 lg:h-6 rounded-md bg-white border border-gray-200 text-red-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                            aria-label="Excluir"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>

                          <button
                            onClick={() => abrirModalEditar(transacao)}
                            className="inline-flex items-center justify-center w-7 h-7 lg:w-6 lg:h-6 rounded-md bg-white border border-gray-200 text-blue-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                            aria-label="Editar"
                            title="Editar"
                          >
                            <PencilLine size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {transacoesFiltradas.length > 0 && (
        <div className="bg-gray-100 rounded-lg px-2 py-1.5 border border-gray-200 text-xs text-slate-600">
          <p>
            <span className="font-semibold text-slate-900">{transacoesFiltradas.length}</span> transação{transacoesFiltradas.length !== 1 ? 's' : ''}
            {dataInicio || dataFim ? ' no período selecionado' : ''}
          </p>
        </div>
      )}
      </div>
    </div>
  )
}
