'use client'

import { useCallback, useMemo, useState } from 'react'
import { BarChart3, CalendarDays, RotateCcw, TrendingDown, TrendingUp, WalletCards } from 'lucide-react'
import { useDadosFinanceiros, type LancamentoFinanceiro } from '@/context/DadosFinanceirosContext'
import { getMesAtualParaInput } from '@/lib/dateUtils'

type TipoCentro = 'RECEITA' | 'DESPESA'
type FiltroTipo = 'todos' | TipoCentro
type MetricaComparativo = FiltroTipo | 'SALDO'

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

const getMesesParaComparacao = (mesSelecionado: string) => {
  const [ano, mes] = mesSelecionado.split('-').map(Number)
  const base = new Date(ano, mes - 1, 1, 12)

  return Array.from({ length: 6 }, (_, index) => {
    const data = new Date(base)
    data.setMonth(base.getMonth() - (5 - index))

    return {
      mes: `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`,
      label: `${nomesMeses[data.getMonth()]}/${String(data.getFullYear()).slice(2)}`,
    }
  })
}

export default function DashboardFinanceiroTab() {
  const { dados, carregando } = useDadosFinanceiros()
  const [mesSelecionado, setMesSelecionado] = useState(getMesAtualParaInput())
  const [centrosSelecionadosIds, setCentrosSelecionadosIds] = useState<string[]>([])
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos')

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
      const atendeCentro = centrosSelecionadosIds.length === 0 || centrosSelecionadosIds.includes(lancamento.centro_custo_id)
      return atendeMes && atendeCentro && lancamentoCombinaComCentro(lancamento)
    })
  }, [centrosSelecionadosIds, dados.todosLancamentosCasa, lancamentoCombinaComCentro, mesSelecionado])

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
      .sort((a, b) => (b.receitas + b.despesas) - (a.receitas + a.despesas))
  }, [centrosPorId, centrosSelecionadosIds, dados.centrosCustoCasa, filtroTipo, lancamentosFiltrados])

  const tipoUnicoSelecionado = centrosSelecionados.length > 0
    ? centrosSelecionados.every(centro => centro.tipo === centrosSelecionados[0].tipo) ? centrosSelecionados[0].tipo : null
    : null
  const metricaComparativo: MetricaComparativo = tipoUnicoSelecionado ?? filtroTipo

  const comparativoMeses = useMemo<LinhaMes[]>(() => {
    const meses = getMesesParaComparacao(mesSelecionado)
    const mapa = new Map<string, LinhaMes>()

    meses.forEach(item => {
      mapa.set(item.mes, { ...item, receitas: 0, despesas: 0, saldo: 0 })
    })

    dados.todosLancamentosCasa.forEach(lancamento => {
      if (centrosSelecionadosIds.length > 0 && !centrosSelecionadosIds.includes(lancamento.centro_custo_id)) return
      if (!lancamentoCombinaComCentro(lancamento)) return

      const linha = mapa.get(getMesLancamento(lancamento))
      if (!linha) return

      const valor = normalizarNumero(lancamento.valor)
      if (lancamento.tipo === 'entrada') linha.receitas += valor
      if (lancamento.tipo === 'saida') linha.despesas += valor
      linha.saldo = linha.receitas - linha.despesas
    })

    return meses.map(item => mapa.get(item.mes)!).filter(Boolean)
  }, [centrosSelecionadosIds, dados.todosLancamentosCasa, lancamentoCombinaComCentro, mesSelecionado])

  const getValorComparativo = (linha: LinhaMes) => {
    if (metricaComparativo === 'RECEITA') return linha.receitas
    if (metricaComparativo === 'DESPESA') return linha.despesas
    return linha.saldo
  }

  const getCorComparativo = (valor: number) => {
    if (metricaComparativo === 'RECEITA') return 'bg-emerald-500'
    if (metricaComparativo === 'DESPESA') return 'bg-red-500'
    return valor >= 0 ? 'bg-blue-500' : 'bg-red-500'
  }

  const getTextoComparativo = (valor: number) => {
    if (metricaComparativo === 'RECEITA') return 'text-emerald-700'
    if (metricaComparativo === 'DESPESA') return 'text-red-700'
    return valor >= 0 ? 'text-blue-700' : 'text-red-700'
  }

  const maiorValorComparativo = Math.max(1, ...comparativoMeses.map(item => Math.abs(getValorComparativo(item))))
  const maiorValorCentro = Math.max(1, ...rankingCentros.map(linha => linha.tipo === 'RECEITA' ? linha.receitas : linha.despesas))

  const mesAnterior = comparativoMeses[comparativoMeses.length - 2]
  const valorAtualComparativo = metricaComparativo === 'RECEITA'
    ? resumoMes.receitas
    : metricaComparativo === 'DESPESA'
      ? resumoMes.despesas
      : saldoMes
  const variacaoComparativo = mesAnterior ? valorAtualComparativo - getValorComparativo(mesAnterior) : 0
  const labelMetrica = metricaComparativo === 'RECEITA'
    ? 'Somente receitas'
    : metricaComparativo === 'DESPESA'
      ? 'Somente despesas'
      : 'Saldo consolidado'

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
  }

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
    <div className="flex h-full min-h-[calc(100vh-120px)] flex-col overflow-hidden px-0 lg:min-h-0">
      <div className="flex-none border border-gray-300 rounded-lg overflow-hidden z-30 bg-white shadow-sm">
        <div className="p-1.5 space-y-1.5 bg-white">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 leading-tight">Dashboard financeiro</p>
              <p className="text-[10px] text-slate-500 leading-tight">Totais por filtros e por CDC</p>
            </div>
            <button
              onClick={limparFiltros}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100"
              title="Limpar filtros"
            >
              <RotateCcw size={12} />
              Limpar
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-700 mb-0.5">Mes</label>
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

            <div className="hidden lg:flex lg:items-end lg:justify-end">
              <div className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                <BarChart3 size={16} />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="block text-[10px] font-semibold text-gray-700">CDCs</label>
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
        </div>
      </div>

      <div className="mt-1.5 flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
        <div className="grid grid-cols-3 gap-1.5">
          <div className={`rounded-lg border px-1.5 py-2 shadow-sm ${
            filtroTipo === 'DESPESA' ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-emerald-200 bg-emerald-50'
          }`}>
            <div className="flex items-center gap-1 text-emerald-700">
              <TrendingUp size={13} />
              <p className="text-[10px] uppercase font-semibold leading-tight">Receitas</p>
            </div>
            <p className="mt-1 text-sm font-medium text-emerald-800 leading-tight truncate">{formatarMoeda(resumoMes.receitas)}</p>
          </div>

          <div className={`rounded-lg border px-1.5 py-2 shadow-sm ${
            filtroTipo === 'RECEITA' ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-red-200 bg-red-50'
          }`}>
            <div className="flex items-center gap-1 text-red-700">
              <TrendingDown size={13} />
              <p className="text-[10px] uppercase font-semibold leading-tight">Despesas</p>
            </div>
            <p className="mt-1 text-sm font-medium text-red-800 leading-tight truncate">{formatarMoeda(resumoMes.despesas)}</p>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 px-1.5 py-2 shadow-sm">
            <div className="flex items-center gap-1 text-blue-700">
              <WalletCards size={13} />
              <p className="text-[10px] uppercase font-semibold leading-tight">Saldo</p>
            </div>
            <p className={`mt-1 text-sm font-medium leading-tight truncate ${saldoMes >= 0 ? 'text-blue-900' : 'text-red-700'}`}>
              {formatarMoeda(saldoMes)}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-900 leading-tight">Por CDC</p>
            <span className="text-[10px] font-semibold text-slate-500">
              Individuais: {rankingCentros.length}
            </span>
          </div>

          {rankingCentros.length === 0 ? (
            <div className="rounded-md bg-gray-50 border border-gray-200 p-3 text-center">
              <p className="text-xs text-gray-600">Nenhum lancamento encontrado para este filtro.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-4">
              {rankingCentros.map(linha => {
                const isReceita = linha.tipo === 'RECEITA'
                const valorPrincipal = isReceita ? linha.receitas : linha.despesas
                const larguraBarra = Math.max(8, Math.min(100, (valorPrincipal / maiorValorCentro) * 100))

                return (
                  <div
                    key={linha.id}
                    className={`rounded-md border px-1.5 py-1.5 shadow-sm ${
                      isReceita ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="min-w-0 flex-1 text-[11px] font-semibold text-slate-900 leading-tight line-clamp-2">{linha.nome}</p>
                      <span className={`rounded px-1 py-0.5 text-[8px] font-bold leading-tight ${
                        isReceita ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {isReceita ? 'REC' : 'DESP'}
                      </span>
                    </div>

                    <p className={`mt-1 text-sm font-semibold leading-tight ${isReceita ? 'text-emerald-800' : 'text-red-800'}`}>
                      {formatarMoeda(valorPrincipal)}
                    </p>

                    <div className="mt-1 flex items-center gap-1">
                      <div className="h-1.5 flex-1 rounded-full bg-white overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isReceita ? 'bg-emerald-500' : 'bg-red-500'}`}
                          style={{ width: `${larguraBarra}%` }}
                        />
                      </div>
                      <span className="text-[8px] font-semibold text-slate-500">{linha.quantidade}x</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 leading-tight">Mes a mes</p>
              <p className="text-xs font-medium text-slate-500 leading-tight truncate">{labelMetrica}</p>
            </div>
            <CalendarDays size={16} className="text-slate-500 flex-none" />
          </div>

          <div className="space-y-1.5">
            {comparativoMeses.map(linha => {
              const valor = getValorComparativo(linha)
              const larguraBarra = Math.max(6, (Math.abs(valor) / maiorValorComparativo) * 100)

              return (
                <div key={linha.mes} className="grid grid-cols-[54px_1fr_110px] items-center gap-1.5 rounded-md bg-slate-50 px-1.5 py-1.5">
                  <span className="text-xs font-medium text-slate-700">{linha.label}</span>
                  <div className="h-2.5 rounded-full bg-white overflow-hidden border border-slate-100">
                    <div className={`h-full rounded-full ${getCorComparativo(valor)}`} style={{ width: `${larguraBarra}%` }} />
                  </div>
                  <span className={`text-right text-sm font-medium ${getTextoComparativo(valor)}`}>
                    {formatarMoeda(valor)}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="mt-1.5 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
            <span className="font-medium">Variacao:</span>{' '}
            <span className={variacaoComparativo >= 0 ? 'font-medium text-emerald-700' : 'font-medium text-red-700'}>
              {variacaoComparativo >= 0 ? '+' : '-'} {formatarMoeda(Math.abs(variacaoComparativo))}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
