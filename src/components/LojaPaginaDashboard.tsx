'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'
import { DashboardConfig } from './ConfigDashboard'

const NOMES_MESES: Record<string, string> = {
  '01': 'Janeiro',
  '02': 'Fevereiro',
  '03': 'Março',
  '04': 'Abril',
  '05': 'Maio',
  '06': 'Junho',
  '07': 'Julho',
  '08': 'Agosto',
  '09': 'Setembro',
  '10': 'Outubro',
  '11': 'Novembro',
  '12': 'Dezembro'
}

const DEFAULT_CONFIG: DashboardConfig = {
  context: 'ambos',
  tipoPadrao: 'saida',
  status: 'todos',
  centrosExcluidos: []
}

interface GrupoCentro {
  centroId: string
  nome: string
  contexto: 'casa' | 'loja'
  valor: number
  percentual: number
}

interface GrupoMensal {
  anoMes: string // 'YYYY-MM'
  nomeMesFormatado: string
  total: number
  centros: GrupoCentro[]
}

export default function LojaPaginaDashboard() {
  const { dados, carregando } = useDadosFinanceiros()
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_CONFIG)

  // Estados para filtros interativos locais (permitem override temporário na sessão)
  const [tipoAtivo, setTipoAtivo] = useState<'entrada' | 'saida'>('saida')
  const [contextoAtivo, setContextoAtivo] = useState<'casa' | 'loja' | 'ambos'>('ambos')
  const [statusAtivo, setStatusAtivo] = useState<'todos' | 'realizado' | 'previsto'>('todos')
  const [anoSelecionado, setAnoSelecionado] = useState<string>('')
  const [mesesExpandidos, setMesesExpandidos] = useState<Record<string, boolean>>({})

  // Carrega as configurações do localStorage e inicializa filtros locais
  useEffect(() => {
    try {
      const salva = localStorage.getItem('lucius_config_dashboard')
      if (salva) {
        const parsed = JSON.parse(salva) as DashboardConfig
        const loadedConfig = {
          context: parsed.context || 'ambos',
          tipoPadrao: parsed.tipoPadrao || 'saida',
          status: parsed.status || 'todos',
          centrosExcluidos: parsed.centrosExcluidos || []
        }
        setConfig(loadedConfig)
        setTipoAtivo(loadedConfig.tipoPadrao)
        setContextoAtivo(loadedConfig.context)
        setStatusAtivo(loadedConfig.status)
      } else {
        setConfig(DEFAULT_CONFIG)
        setTipoAtivo('saida')
        setContextoAtivo('ambos')
        setStatusAtivo('todos')
      }
    } catch (err) {
      console.error('Erro ao ler configuração do dashboard:', err)
    }
  }, [])

  // Combina todos os lançamentos de Casa e Loja de acordo com o contexto ativo
  const lancamentosTrabalho = useMemo(() => {
    let list: any[] = []
    if (contextoAtivo === 'ambos') {
      list = [...dados.todosLancamentosCasa, ...dados.todosLancamentosLoja]
    } else if (contextoAtivo === 'casa') {
      list = [...dados.todosLancamentosCasa]
    } else {
      list = [...dados.todosLancamentosLoja]
    }
    return list
  }, [dados.todosLancamentosCasa, dados.todosLancamentosLoja, contextoAtivo])

  // Obtém a lista de anos disponíveis nos dados para preencher o seletor de ano
  const listaAnos = useMemo(() => {
    const anosSet = new Set<string>()
    lancamentosTrabalho.forEach(l => {
      const dataStr = l.data_prevista || l.data_lancamento || l.data || ''
      if (dataStr && dataStr.length >= 4) {
        anosSet.add(dataStr.slice(0, 4))
      }
    })
    const anos = Array.from(anosSet).sort((a, b) => b.localeCompare(a)) // Decrescente

    // Se o ano selecionado estiver vazio ou não existir na nova lista, selecionamos o mais recente por padrão
    if (anos.length > 0 && !anoSelecionado) {
      const anoAtual = new Date().getFullYear().toString()
      if (anos.includes(anoAtual)) {
        setAnoSelecionado(anoAtual)
      } else {
        setAnoSelecionado(anos[0])
      }
    }
    return anos
  }, [lancamentosTrabalho, anoSelecionado])

  // Processa e agrupa os lançamentos de acordo com os filtros
  const dadosAgrupados = useMemo((): GrupoMensal[] => {
    if (carregando || lancamentosTrabalho.length === 0) return []

    // 1. Filtrar lançamentos
    const filtrados = lancamentosTrabalho.filter(l => {
      // Filtro de tipo: 'entrada' (receita) ou 'saida' (despesa)
      if (l.tipo !== tipoAtivo) return false

      // Filtro de status: 'realizado' (pago), 'previsto' (pendente) ou 'todos'
      if (statusAtivo === 'realizado' && l.status !== 'realizado') return false
      if (statusAtivo === 'previsto' && l.status !== 'previsto') return false

      // Filtro de Centro de Custo excluído
      if (config.centrosExcluidos.includes(l.centro_custo_id)) return false

      // Filtro de ano
      const dataStr = l.data_prevista || l.data_lancamento || l.data || ''
      if (!dataStr || !dataStr.startsWith(anoSelecionado)) return false

      return true
    })

    // 2. Agrupar por Ano-Mês e Centro de Custo
    const mapaMensal: Record<string, Record<string, number>> = {}

    filtrados.forEach(l => {
      const dataStr = l.data_prevista || l.data_lancamento || l.data || ''
      const anoMes = dataStr.slice(0, 7) // 'YYYY-MM'
      const cdcId = l.centro_custo_id || 'sem-centro'

      if (!mapaMensal[anoMes]) {
        mapaMensal[anoMes] = {}
      }
      if (!mapaMensal[anoMes][cdcId]) {
        mapaMensal[anoMes][cdcId] = 0
      }
      mapaMensal[anoMes][cdcId] += l.valor
    })

    // Criar mapa rápido de nomes de Centros de Custo para evitar loops
    const todosCentros = [...dados.centrosCustoCasa, ...dados.centrosCustoLoja]
    const cdcMap = new Map<string, { nome: string; contexto: 'casa' | 'loja' }>()
    todosCentros.forEach(c => {
      cdcMap.set(c.id, { nome: c.nome, contexto: c.contexto })
    })

    // 3. Estruturar dados agrupados
    const resultado: GrupoMensal[] = Object.entries(mapaMensal).map(([anoMes, centrosMap]) => {
      const totalMes = Object.values(centrosMap).reduce((acc, val) => acc + val, 0)

      const centrosList: GrupoCentro[] = Object.entries(centrosMap).map(([cdcId, valor]) => {
        const info = cdcMap.get(cdcId) || { nome: cdcId === 'sem-centro' ? 'Sem Centro de Custo' : 'Centro Desconhecido', contexto: 'loja' as const }
        return {
          centroId: cdcId,
          nome: info.nome,
          contexto: info.contexto,
          valor,
          percentual: totalMes > 0 ? (valor / totalMes) * 100 : 0
        }
      })

      // Ordenar os centros de custo pelo valor em ordem decrescente (maiores despesas no topo)
      centrosList.sort((a, b) => b.valor - a.valor)

      // Formatar o mês em português
      const [ano, mes] = anoMes.split('-')
      const nomeMes = NOMES_MESES[mes] || mes
      const nomeMesFormatado = `${nomeMes} de ${ano}`

      return {
        anoMes,
        nomeMesFormatado,
        total: totalMes,
        centros: centrosList
      }
    })

    // Ordenar os meses de forma decrescente (mês mais recente no topo)
    resultado.sort((a, b) => b.anoMes.localeCompare(a.anoMes))

    // Expandir o primeiro mês por padrão se houver resultados e ainda não houver nenhum estado definido
    if (resultado.length > 0 && Object.keys(mesesExpandidos).length === 0) {
      const firstMonth = resultado[0].anoMes
      setTimeout(() => {
        setMesesExpandidos({ [firstMonth]: true })
      }, 0)
    }

    return resultado
  }, [lancamentosTrabalho, tipoAtivo, statusAtivo, config.centrosExcluidos, anoSelecionado, carregando, dados.centrosCustoCasa, dados.centrosCustoLoja])

  // Estatísticas gerais baseadas no resultado agrupado
  const estatisticas = useMemo(() => {
    let totalGeral = 0
    let topCentroNome = 'Nenhum'
    let topCentroValor = 0
    const acumuladoCentros: Record<string, { nome: string; valor: number }> = {}

    dadosAgrupados.forEach(mes => {
      totalGeral += mes.total
      mes.centros.forEach(c => {
        if (!acumuladoCentros[c.centroId]) {
          acumuladoCentros[c.centroId] = { nome: c.nome, valor: 0 }
        }
        acumuladoCentros[c.centroId].valor += c.valor
      })
    })

    Object.values(acumuladoCentros).forEach(c => {
      if (c.valor > topCentroValor) {
        topCentroValor = c.valor
        topCentroNome = c.nome
      }
    })

    const mediaMensal = dadosAgrupados.length > 0 ? totalGeral / dadosAgrupados.length : 0

    return {
      totalGeral,
      mediaMensal,
      topCentroNome,
      topCentroValor
    }
  }, [dadosAgrupados])

  const toggleMes = (anoMes: string) => {
    setMesesExpandidos(prev => ({
      ...prev,
      [anoMes]: !prev[anoMes]
    }))
  }

  const handleRestaurarConfig = () => {
    setTipoAtivo(config.tipoPadrao)
    setContextoAtivo(config.context)
    setStatusAtivo(config.status)
  }

  if (carregando) {
    return (
      <div className="bg-white rounded p-6 shadow text-center border border-gray-200">
        <div className="text-sm font-semibold text-gray-500 animate-pulse">
          ⏳ Carregando dados do Dashboard...
        </div>
      </div>
    )
  }

  const isConfigDiferente = tipoAtivo !== config.tipoPadrao || contextoAtivo !== config.context || statusAtivo !== config.status

  return (
    <div className="space-y-3 pb-6">
      {/* Menu Superior de Toggles e Filtros Rápidos (Otimizado para Mobile) */}
      <div className="bg-white rounded shadow-sm border border-gray-200 p-2 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">

          {/* Seletor de Tipo (Despesa / Receita) */}
          <div className="grid grid-cols-2 gap-1 flex-1 sm:flex-none">
            <button
              onClick={() => setTipoAtivo('saida')}
              className={`py-1.5 px-3 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                tipoAtivo === 'saida'
                  ? 'bg-red-600 text-white shadow'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>🛑</span> Despesas
            </button>
            <button
              onClick={() => setTipoAtivo('entrada')}
              className={`py-1.5 px-3 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                tipoAtivo === 'entrada'
                  ? 'bg-green-600 text-white shadow'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>🟢</span> Receitas
            </button>
          </div>

          {/* Filtros Rápidos */}
          <div className="flex flex-nowrap overflow-x-auto gap-1.5 pb-1 sm:pb-0 custom-scrollbar">
            {/* Contexto */}
            <select
              value={contextoAtivo}
              onChange={(e) => setContextoAtivo(e.target.value as any)}
              className="px-2 py-1 border border-gray-300 rounded text-xs bg-white text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0"
              title="Filtrar por Contexto"
            >
              <option value="ambos">🏠+🏪 Ambos</option>
              <option value="casa">🏠 Casa</option>
              <option value="loja">🏪 Loja</option>
            </select>

            {/* Status */}
            <select
              value={statusAtivo}
              onChange={(e) => setStatusAtivo(e.target.value as any)}
              className="px-2 py-1 border border-gray-300 rounded text-xs bg-white text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0"
              title="Filtrar por Status"
            >
              <option value="todos">📋 Todos os Lançamentos</option>
              <option value="realizado">✓ Pagos / Recebidos</option>
              <option value="previsto">⏳ Pendentes / Previstos</option>
            </select>

            {/* Ano */}
            <select
              value={anoSelecionado}
              onChange={(e) => setAnoSelecionado(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-xs bg-white text-gray-700 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0"
              title="Selecionar Ano"
            >
              {listaAnos.length === 0 ? (
                <option value="">Sem dados</option>
              ) : (
                listaAnos.map(ano => (
                  <option key={ano} value={ano}>📅 {ano}</option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Notificação de Filtros Customizados */}
        {isConfigDiferente && (
          <div className="flex justify-between items-center bg-blue-50 border border-blue-200 px-2 py-1 rounded text-[10px] text-blue-800">
            <span>💡 Mostrando filtros temporários na sessão.</span>
            <button onClick={handleRestaurarConfig} className="font-bold underline hover:text-blue-950">
              Restaurar Padrão
            </button>
          </div>
        )}
      </div>

      {/* Cards de Resumo Rápido (Responsivos) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            Total {tipoAtivo === 'saida' ? 'de Despesas' : 'de Receitas'} ({anoSelecionado})
          </span>
          <span className={`text-base sm:text-lg font-black mt-1 ${tipoAtivo === 'saida' ? 'text-red-600' : 'text-green-600'}`}>
            R$ {estatisticas.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Média Mensal</span>
          <span className="text-base sm:text-lg font-bold text-gray-800 mt-1">
            R$ {estatisticas.mediaMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Maior Centro de Custo</span>
          <span className="text-xs sm:text-sm font-bold text-gray-800 truncate mt-1" title={estatisticas.topCentroNome}>
            {estatisticas.topCentroNome}
            <span className="text-[10px] text-gray-500 font-semibold block sm:inline sm:ml-1">
              (R$ {estatisticas.topCentroValor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })})
            </span>
          </span>
        </div>
      </div>

      {/* Conteúdo Principal do Dashboard */}
      {dadosAgrupados.length === 0 ? (
        <div className="bg-white rounded-lg p-8 shadow-sm text-center border border-gray-200">
          <span className="text-2xl">📭</span>
          <p className="text-xs text-gray-500 mt-2">Nenhum lançamento corresponde aos filtros ativos.</p>
          <p className="text-[10px] text-gray-400 mt-1">Verifique se você não ocultou os centros de custo nas Configurações.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dadosAgrupados.map((mes) => {
            const expandido = !!mesesExpandidos[mes.anoMes]
            return (
              <div
                key={mes.anoMes}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all"
              >
                {/* Cabeçalho do Mês */}
                <button
                  onClick={() => toggleMes(mes.anoMes)}
                  className="w-full text-left px-3 py-2 flex justify-between items-center hover:bg-gray-50 transition-colors focus:outline-none border-b border-gray-100"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📅</span>
                    <span className="text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-tight">
                      {mes.nomeMesFormatado}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className={`text-xs sm:text-sm font-extrabold ${tipoAtivo === 'saida' ? 'text-red-600' : 'text-green-600'}`}>
                      R$ {mes.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs text-gray-400">{expandido ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Lista de Centros de Custo (Expandida) */}
                {expandido && (
                  <div className="p-3 bg-gray-50 space-y-3">
                    {mes.centros.map((centro) => {
                      const percentText = centro.percentual.toFixed(1)
                      const isSaida = tipoAtivo === 'saida'
                      const isCasa = centro.contexto === 'casa'

                      // Seleção de cores e detalhes visuais
                      const colorClass = isSaida ? 'bg-pink-600' : 'bg-green-600'
                      const badgeColor = isCasa ? 'bg-green-100 text-green-800 border-green-200' : 'bg-purple-100 text-purple-800 border-purple-200'
                      const badgeLabel = isCasa ? 'CASA' : 'LOJA'

                      return (
                        <div key={centro.centroId} className="space-y-1 bg-white p-2 rounded-md shadow-xs border border-gray-100 hover:bg-gray-100 transition-colors">
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-1.5 truncate max-w-[70%]">
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${badgeColor}`}>
                                {badgeLabel}
                              </span>
                              <span className="font-semibold text-gray-800 truncate" title={centro.nome}>
                                {centro.nome}
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-extrabold text-gray-800">
                                R$ {centro.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className="text-[10px] text-gray-500 ml-1.5">
                                ({percentText}%)
                              </span>
                            </div>
                          </div>

                          {/* Barra de Progresso Customizada */}
                          <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
                              style={{ width: `${centro.percentual}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
