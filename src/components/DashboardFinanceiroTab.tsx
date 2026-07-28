'use client'

import { useCallback, useMemo, useState } from 'react'
import { CalendarDays, RotateCcw, TrendingDown, TrendingUp, WalletCards, ChevronDown, ChevronUp, Filter, Eye, EyeOff } from 'lucide-react'
import { useDadosFinanceiros, type LancamentoFinanceiro } from '@/context/DadosFinanceirosContext'
import { getMesAtualParaInput } from '@/lib/dateUtils'

type TipoCentro = 'RECEITA' | 'DESPESA'
type FiltroTipo = 'todos' | TipoCentro
type RangeComparativo = 'padrao' | 'ano' | 'tudo'

type LinhaCentroCusto = {
  id: string
  nome: string
  tipo: TipoCentro
  receitas: number
  despesas: number
  saldo: number
  quantidade: number
}

type LinhaMes = {
  mes: string
  label: string
  receitas: number
  despesas: number
  saldo: number
}

const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)

const normalizarNumero = (valor: unknown) => {
  const numero = Number(valor ?? 0)
  return Number.isFinite(numero) ? numero : 0
}

const normalizarTipoCentro = (tipo: unknown): TipoCentro =>
  String(tipo ?? '').trim().toUpperCase() === 'RECEITA' ? 'RECEITA' : 'DESPESA'

const tipoCentroParaLancamento = (tipo: TipoCentro) => tipo === 'RECEITA' ? 'entrada' : 'saida'

const getDataBase = (lancamento: LancamentoFinanceiro) =>
  String((lancamento.status === 'realizado' ? lancamento.data_lancamento : lancamento.data_prevista) || lancamento.data || '').split('T')[0]

const getMesLancamento = (lancamento: LancamentoFinanceiro) => getDataBase(lancamento).slice(0, 7)

const getMesesPadrao = (mesCentral: string) => {
  const [ano, mes] = mesCentral.split('-').map(Number)
  const base = new Date(ano, mes - 1, 1, 12)
  return Array.from({ length: 7 }, (_, index) => {
    const data = new Date(base)
    data.setMonth(base.getMonth() - (3 - index))
    return {
      mes: `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`,
      label: `${nomesMeses[data.getMonth()]}/${String(data.getFullYear()).slice(2)}`,
    }
  })
}

const formatarData = (data: string) => {
  if (!data) return ''
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

export default function DashboardFinanceiroTab() {
  const { dados, carregando } = useDadosFinanceiros()
  const [mesSelecionado, setMesSelecionado] = useState(getMesAtualParaInput())
  const [centrosSelecionadosIds, setCentrosSelecionadosIds] = useState<string[]>([])
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos')
  const [showCdcSelector, setShowCdcSelector] = useState(false)
  const [rangeComparativo, setRangeComparativo] = useState<RangeComparativo>('padrao')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [showFilters, setShowFilters] = useState(true)

  const centrosPorId = useMemo(() => {
    const mapa = new Map<string, { nome: string; tipo: TipoCentro }>()
    dados.centrosCustoCasa.forEach(centro => {
      mapa.set(centro.id, {
        nome: centro.nome,
        tipo: normalizarTipoCentro(centro.tipo),
      })
    })
    return mapa
  }, [dados.centrosCustoCasa])

  const centrosFiltrados = useMemo(() => {
    return dados.centrosCustoCasa.filter(centro => filtroTipo === 'todos' || normalizarTipoCentro(centro.tipo) === filtroTipo)
  }, [dados.centrosCustoCasa, filtroTipo])

  const centrosSelecionados = centrosSelecionadosIds
    .map(id => centrosPorId.get(id))
    .filter((centro): centro is { nome: string; tipo: TipoCentro } => Boolean(centro))

  const lancamentoCombinaComCentro = useCallback((lancamento: LancamentoFinanceiro) => {
    const centro = centrosPorId.get(lancamento.centro_custo_id)
    const tipoCentro = centro?.tipo ?? (lancamento.tipo === 'entrada' ? 'RECEITA' : 'DESPESA')
    const atendeTipoCentro = lancamento.tipo === tipoCentroParaLancamento(tipoCentro)
    const atendeFiltroTipo = filtroTipo === 'todos' || tipoCentro === filtroTipo
    return atendeTipoCentro && atendeFiltroTipo
  }, [centrosPorId, filtroTipo])

  const lancamentosFiltrados = useMemo(() => {
    return dados.todosLancamentosCasa.filter(lancamento => {
      const atendeMes = getMesLancamento(lancamento) === mesSelecionado
      const dataBase = getDataBase(lancamento)
      const atendePeriodo = (!dataInicio || dataBase >= dataInicio) && (!dataFim || dataBase <= dataFim)
      const atendeCentro = centrosSelecionadosIds.length === 0 || centrosSelecionadosIds.includes(lancamento.centro_custo_id)
      return atendeMes && atendePeriodo && atendeCentro && lancamentoCombinaComCentro(lancamento)
    })
  }, [centrosSelecionadosIds, dados.todosLancamentosCasa, lancamentoCombinaComCentro, mesSelecionado, dataInicio, dataFim])

  const resumoMes = useMemo(() => {
    return lancamentosFiltrados.reduce(
      (acc, lancamento) => {
        const valor = normalizarNumero(lancamento.valor)
        if (lancamento.tipo === 'entrada') acc.receitas += valor
        if (lancamento.tipo === 'saida') acc.despesas += valor
        acc.quantidade += 1
        return acc
      },
      { receitas: 0, despesas: 0, quantidade: 0 }
    )
  }, [lancamentosFiltrados])

  const saldoMes = resumoMes.receitas - resumoMes.despesas

  const rankingCentros = useMemo<LinhaCentroCusto[]>(() => {
    const mapa = new Map<string, LinhaCentroCusto>()

    dados.centrosCustoCasa.forEach(centro => {
      const tipo = normalizarTipoCentro(centro.tipo)
      if (filtroTipo !== 'todos' && tipo !== filtroTipo) return

      mapa.set(centro.id, {
        id: centro.id,
        nome: centro.nome,
        tipo,
        receitas: 0,
        despesas: 0,
        saldo: 0,
        quantidade: 0,
      })
    })

    lancamentosFiltrados.forEach(lancamento => {
      const id = lancamento.centro_custo_id || 'sem-centro'
      const linha = mapa.get(id) ?? {
        id,
        nome: centrosPorId.get(id)?.nome || 'Sem centro de custo',
        tipo: lancamento.tipo === 'entrada' ? 'RECEITA' : 'DESPESA',
        receitas: 0,
        despesas: 0,
        saldo: 0,
        quantidade: 0,
      }

      const valor = normalizarNumero(lancamento.valor)
      if (linha.tipo === 'RECEITA') linha.receitas += valor
      if (linha.tipo === 'DESPESA') linha.despesas += valor
      linha.saldo = linha.receitas - linha.despesas
      linha.quantidade += 1
      mapa.set(id, linha)
    })

    return Array.from(mapa.values())
      .filter(linha => linha.quantidade > 0 || centrosSelecionadosIds.includes(linha.id))
      .sort((a, b) => {
        if (a.tipo !== b.tipo) return a.tipo === 'RECEITA' ? -1 : 1
        return (b.receitas + b.despesas) - (a.receitas + a.despesas)
      })
  }, [centrosPorId, centrosSelecionadosIds, dados.centrosCustoCasa, filtroTipo, lancamentosFiltrados])

  const receitasCDC = useMemo(() => rankingCentros.filter(r => r.tipo === 'RECEITA'), [rankingCentros])
  const despesasCDC = useMemo(() => rankingCentros.filter(r => r.tipo === 'DESPESA'), [rankingCentros])

  const mesAtualStr = getMesAtualParaInput()

  const comparativoMeses = useMemo<LinhaMes[]>(() => {
    let meses: { mes: string; label: string }[]

    if (rangeComparativo === 'padrao') {
      meses = getMesesPadrao(mesAtualStr)
    } else if (rangeComparativo === 'ano') {
      const ano = mesAtualStr.split('-')[0]
      meses = Array.from({ length: 12 }, (_, i) => ({
        mes: `${ano}-${String(i + 1).padStart(2, '0')}`,
        label: `${nomesMeses[i]}/${ano.slice(2)}`,
      }))
    } else {
      const mesesSet = new Set<string>()
      dados.todosLancamentosCasa.forEach(l => {
        const mLanc = getMesLancamento(l)
        if (mLanc) mesesSet.add(mLanc)
      })
      meses = Array.from(mesesSet).sort().map(m => {
        const [anoM, mesM] = m.split('-').map(Number)
        return {
          mes: m,
          label: `${nomesMeses[mesM - 1]}/${String(anoM).slice(2)}`,
        }
      })
      if (meses.length === 0) {
        meses = getMesesPadrao(mesAtualStr)
      }
    }

    const mapa = new Map<string, LinhaMes>()

    meses.forEach(item => {
      mapa.set(item.mes, { ...item, receitas: 0, despesas: 0, saldo: 0 })
    })

    dados.todosLancamentosCasa.forEach(lancamento => {
      const linha = mapa.get(getMesLancamento(lancamento))
      if (!linha) return

      const valor = normalizarNumero(lancamento.valor)
      if (lancamento.tipo === 'entrada') linha.receitas += valor
      if (lancamento.tipo === 'saida') linha.despesas += valor
      linha.saldo = linha.receitas - linha.despesas
    })

    return meses.map(item => mapa.get(item.mes)!).filter(Boolean)
  }, [dados.todosLancamentosCasa, mesAtualStr, rangeComparativo])

  const maiorValorComparativo = Math.max(1, ...comparativoMeses.map(item => Math.abs(item.saldo)))

  const mesAtualComparativo = comparativoMeses.find(m => m.mes === mesAtualStr)
  const mesAnterior = comparativoMeses.length >= 2 ? comparativoMeses[comparativoMeses.length - 2] : null
  const variacaoComparativo = mesAnterior && mesAtualComparativo
    ? mesAtualComparativo.saldo - mesAnterior.saldo
    : 0

  const handleMudarTipo = (novoTipo: FiltroTipo) => {
    setFiltroTipo(novoTipo)

    if (novoTipo !== 'todos') {
      setCentrosSelecionadosIds(ids => ids.filter(id => centrosPorId.get(id)?.tipo === novoTipo))
    }
  }

  const alternarCentro = (centroId: string) => {
    setCentrosSelecionadosIds(ids =>
      ids.includes(centroId)
        ? ids.filter(id => id !== centroId)
        : [...ids, centroId]
    )
  }

  const limparFiltros = () => {
    setMesSelecionado(getMesAtualParaInput())
    setFiltroTipo('todos')
    setCentrosSelecionadosIds([])
    setShowCdcSelector(false)
    setRangeComparativo('padrao')
    setDataInicio('')
    setDataFim('')
  }

  const temFiltroPeriodo = dataInicio || dataFim

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-120px)] flex-col overflow-hidden px-1 lg:min-h-0 lg:px-2">
      <div className="flex-none border border-gray-300 rounded-lg overflow-hidden z-30 bg-white shadow-sm">
        <div className="p-2 space-y-2 bg-white">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex items-center gap-2">
              <p className="text-xs font-bold text-slate-900 leading-tight">Dashboard financeiro</p>
              <p className="text-[10px] text-slate-500 leading-tight hidden sm:inline">Totais por filtros e por CDC</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100"
                title={showFilters ? 'Esconder filtros' : 'Mostrar filtros'}
              >
                {showFilters ? <EyeOff size={12} /> : <Eye size={12} />}
                {showFilters ? 'Filtros' : 'Mostrar'}
              </button>
              <button
                onClick={limparFiltros}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100"
                title="Limpar filtros"
              >
                <RotateCcw size={12} />
                Limpar
              </button>
            </div>
          </div>

          {showFilters && (
            <>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-700 mb-0.5">Mês</label>
                  <input
                    type="month"
                    value={mesSelecionado}
                    onChange={(event) => setMesSelecionado(event.target.value || getMesAtualParaInput())}
                    className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-700 mb-0.5">Tipo</label>
                  <select
                    value={filtroTipo}
                    onChange={(event) => handleMudarTipo(event.target.value as FiltroTipo)}
                    className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs"
                  >
                    <option value="todos">Todos</option>
                    <option value="RECEITA">Receitas</option>
                    <option value="DESPESA">Despesas</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-700 mb-0.5">Período início</label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-700 mb-0.5">Período fim</label>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-gray-700 mb-0.5">Mês a mês</label>
                  <select
                    value={rangeComparativo}
                    onChange={(e) => setRangeComparativo(e.target.value as RangeComparativo)}
                    className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs"
                  >
                    <option value="padrao">Padrão (3+1+3)</option>
                    <option value="ano">Ano atual</option>
                    <option value="tudo">Tudo</option>
                  </select>
                </div>

                <div className="flex-1 flex items-end">
                  <button
                    onClick={() => setShowCdcSelector(!showCdcSelector)}
                    className="w-full inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Filter size={12} />
                    CDCs
                    {showCdcSelector ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
              </div>

              {showCdcSelector && (
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="block text-[10px] font-semibold text-gray-700">Selecionar CDCs</label>
                    <span className="text-[10px] font-medium text-slate-500">
                      {centrosSelecionadosIds.length === 0 ? 'Todos' : `${centrosSelecionadosIds.length} selecionado${centrosSelecionadosIds.length > 1 ? 's' : ''}`}
                    </span>
                  </div>

                  <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto pr-1">
                    {centrosFiltrados.map(centro => {
                      const selecionado = centrosSelecionadosIds.includes(centro.id)
                      const tipo = normalizarTipoCentro(centro.tipo)
                      const isReceita = tipo === 'RECEITA'

                      return (
                        <button
                          key={centro.id}
                          onClick={() => alternarCentro(centro.id)}
                          className={`rounded-md border px-1.5 py-1 text-[10px] font-medium leading-tight transition-colors ${
                            selecionado
                              ? isReceita
                                ? 'border-emerald-500 bg-emerald-100 text-emerald-900'
                                : 'border-red-500 bg-red-100 text-red-900'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {centro.nome}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-1.5 flex-1 min-h-0 overflow-y-auto space-y-1.5 px-0.5">
        <div className="grid grid-cols-3 gap-2">
          <div className={`rounded-lg border px-2 py-2 shadow-sm ${
            temFiltroPeriodo ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'
          }`}>
            <div className="flex items-center gap-1" style={{ color: temFiltroPeriodo ? '#d97706' : '#1d4ed8' }}>
              <WalletCards size={13} />
              <p className="text-[10px] uppercase font-semibold leading-tight">Saldo</p>
            </div>
            <p className={`mt-1 text-sm font-medium leading-tight truncate ${saldoMes >= 0 ? (temFiltroPeriodo ? 'text-amber-900' : 'text-blue-900') : 'text-red-700'}`}>
              {formatarMoeda(saldoMes)}
            </p>
            {temFiltroPeriodo && (
              <p className="text-[8px] text-amber-600 leading-tight mt-0.5">
                {formatarData(dataInicio) || '...'} até {formatarData(dataFim) || '...'}
              </p>
            )}
          </div>

          <div className={`rounded-lg border px-2 py-2 shadow-sm ${
            filtroTipo === 'DESPESA' ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-emerald-200 bg-emerald-50'
          }`}>
            <div className="flex items-center gap-1 text-emerald-700">
              <TrendingUp size={13} />
              <p className="text-[10px] uppercase font-semibold leading-tight">Receitas</p>
            </div>
            <p className="mt-1 text-sm font-medium text-emerald-800 leading-tight truncate">{formatarMoeda(resumoMes.receitas)}</p>
          </div>

          <div className={`rounded-lg border px-2 py-2 shadow-sm ${
            filtroTipo === 'RECEITA' ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-red-200 bg-red-50'
          }`}>
            <div className="flex items-center gap-1 text-red-700">
              <TrendingDown size={13} />
              <p className="text-[10px] uppercase font-semibold leading-tight">Despesas</p>
            </div>
            <p className="mt-1 text-sm font-medium text-red-800 leading-tight truncate">{formatarMoeda(resumoMes.despesas)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr] gap-2">
          <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
            <div className="mb-1.5 flex items-center justify-between gap-1">
              <div className="min-w-0">
                <p className="text-base font-bold text-slate-900 leading-tight">Mês a mês</p>
                <p className="text-[11px] font-medium text-slate-500 leading-tight truncate">Saldo consolidado</p>
              </div>
              <CalendarDays size={16} className="text-slate-500 flex-none" />
            </div>

            <div className="space-y-1">
              {comparativoMeses.map(linha => {
                const isAtual = linha.mes === mesAtualStr
                const isFiltrado = linha.mes === mesSelecionado && mesSelecionado !== mesAtualStr
                const larguraBarra = Math.max(4, (Math.abs(linha.saldo) / maiorValorComparativo) * 100)

                let rowStyle = 'bg-slate-50'
                if (isAtual) {
                  rowStyle = 'bg-blue-100 border-2 border-blue-400 ring-2 ring-blue-300 shadow-md'
                } else if (isFiltrado) {
                  rowStyle = 'bg-purple-50 border border-purple-300 ring-1 ring-purple-200'
                }

                return (
                  <div
                    key={linha.mes}
                    className={`grid grid-cols-[54px_1fr_110px] items-center gap-1.5 rounded-md px-1.5 py-1.5 ${rowStyle}`}
                  >
                    <span className={`text-xs font-medium ${isAtual ? 'text-blue-900 font-bold' : isFiltrado ? 'text-purple-800 font-bold' : 'text-slate-700'}`}>
                      {linha.label}
                      {isAtual && <span className="ml-1.5 text-[10px] font-bold text-blue-700">◄ atual</span>}
                      {isFiltrado && <span className="ml-1.5 text-[10px] font-bold text-purple-600">◄ filtro</span>}
                    </span>
                    <div className="h-3 rounded-full bg-white overflow-hidden border border-slate-100">
                      <div
                        className={`h-full rounded-full ${linha.saldo >= 0 ? 'bg-blue-500' : 'bg-red-500'}`}
                        style={{ width: `${larguraBarra}%` }}
                      />
                    </div>
                    <span className={`text-right text-xs font-semibold ${linha.saldo >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                      {formatarMoeda(linha.saldo)}
                    </span>
                  </div>
                )
              })}
            </div>

            {mesAnterior && mesAtualComparativo && (
              <div className="mt-1.5 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                <span className="font-medium">Variação (último mês):</span>{' '}
                <span className={variacaoComparativo >= 0 ? 'font-medium text-emerald-700' : 'font-medium text-red-700'}>
                  {variacaoComparativo >= 0 ? '+' : '-'} {formatarMoeda(Math.abs(variacaoComparativo))}
                </span>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-emerald-200 bg-white p-1.5 shadow-sm">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <TrendingUp size={13} className="text-emerald-600" />
                <p className="text-xs font-bold uppercase text-emerald-700">CDC Receitas</p>
              </div>
              <span className="text-xs font-semibold text-slate-500">{receitasCDC.length}</span>
            </div>

            {receitasCDC.length === 0 ? (
              <div className="rounded-md bg-gray-50 border border-gray-200 p-2 text-center">
                <p className="text-xs text-gray-600">Nenhuma receita.</p>
              </div>
            ) : (
              <div className="space-y-0.5 max-h-60 overflow-y-auto">
                {receitasCDC.map(linha => (
                  <div
                    key={linha.id}
                    className="flex items-center justify-between rounded-md bg-emerald-50/60 px-1 py-0.5 hover:bg-emerald-50"
                  >
                    <span className="text-xs font-medium text-slate-800 truncate mr-1.5">{linha.nome}</span>
                    <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">
                      {formatarMoeda(linha.receitas)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-red-200 bg-white p-1.5 shadow-sm">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <TrendingDown size={13} className="text-red-600" />
                <p className="text-xs font-bold uppercase text-red-700">CDC Despesas</p>
              </div>
              <span className="text-xs font-semibold text-slate-500">{despesasCDC.length}</span>
            </div>

            {despesasCDC.length === 0 ? (
              <div className="rounded-md bg-gray-50 border border-gray-200 p-2 text-center">
                <p className="text-xs text-gray-600">Nenhuma despesa.</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {despesasCDC.map(linha => (
                  <div
                    key={linha.id}
                    className="flex items-center justify-between rounded-md bg-red-50/60 px-1 py-0.5 hover:bg-red-50"
                  >
                    <span className="text-xs font-medium text-slate-800 truncate mr-1.5">{linha.nome}</span>
                    <span className="text-xs font-semibold text-red-700 whitespace-nowrap">
                      {formatarMoeda(linha.despesas)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
