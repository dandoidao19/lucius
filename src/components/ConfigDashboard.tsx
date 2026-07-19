'use client'

import { useState, useEffect } from 'react'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'

export interface DashboardConfig {
  context: 'casa' | 'loja' | 'ambos'
  tipoPadrao: 'entrada' | 'saida'
  status: 'todos' | 'realizado' | 'previsto'
  centrosExcluidos: string[]
}

const DEFAULT_CONFIG: DashboardConfig = {
  context: 'ambos',
  tipoPadrao: 'saida',
  status: 'todos',
  centrosExcluidos: []
}

export default function ConfigDashboard() {
  const { dados, carregando } = useDadosFinanceiros()
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_CONFIG)
  const [salvando, setSalvando] = useState(false)
  const [mensagemSucesso, setMensagemSucesso] = useState('')

  // Carregar configurações existentes do localStorage
  useEffect(() => {
    try {
      const salva = localStorage.getItem('lucius_config_dashboard')
      if (salva) {
        const parsed = JSON.parse(salva)
        setConfig({
          context: parsed.context || 'ambos',
          tipoPadrao: parsed.tipoPadrao || 'saida',
          status: parsed.status || 'todos',
          centrosExcluidos: parsed.centrosExcluidos || []
        })
      }
    } catch (err) {
      console.error('Erro ao ler configuração do dashboard:', err)
    }
  }, [])

  const salvarConfig = (novaConfig: DashboardConfig) => {
    try {
      localStorage.setItem('lucius_config_dashboard', JSON.stringify(novaConfig))
      setConfig(novaConfig)
      setMensagemSucesso('Configurações salvas com sucesso!')
      setTimeout(() => setMensagemSucesso(''), 3000)
    } catch (err) {
      console.error('Erro ao salvar configuração do dashboard:', err)
      alert('❌ Erro ao salvar configurações')
    }
  }

  const handleToggleCentro = (id: string) => {
    let novosExcluidos = [...config.centrosExcluidos]
    if (novosExcluidos.includes(id)) {
      // Remover da lista de excluídos -> Incluir no Dashboard
      novosExcluidos = novosExcluidos.filter(item => item !== id)
    } else {
      // Adicionar à lista de excluídos -> Ocultar do Dashboard
      novosExcluidos.push(id)
    }
    const novaConfig = { ...config, centrosExcluidos: novosExcluidos }
    salvarConfig(novaConfig)
  }

  const handleMarcarTodos = (contexto: 'casa' | 'loja' | 'global') => {
    let novosExcluidos = [...config.centrosExcluidos]

    if (contexto === 'casa') {
      const idsCasa = dados.centrosCustoCasa.map(c => c.id)
      novosExcluidos = novosExcluidos.filter(id => !idsCasa.includes(id))
    } else if (contexto === 'loja') {
      const idsLoja = dados.centrosCustoLoja.map(c => c.id)
      novosExcluidos = novosExcluidos.filter(id => !idsLoja.includes(id))
    } else {
      novosExcluidos = []
    }

    const novaConfig = { ...config, centrosExcluidos: novosExcluidos }
    salvarConfig(novaConfig)
  }

  const handleDesmarcarTodos = (contexto: 'casa' | 'loja' | 'global') => {
    const novosExcluidos = [...config.centrosExcluidos]

    if (contexto === 'casa') {
      dados.centrosCustoCasa.forEach(c => {
        if (!novosExcluidos.includes(c.id)) {
          novosExcluidos.push(c.id)
        }
      })
    } else if (contexto === 'loja') {
      dados.centrosCustoLoja.forEach(c => {
        if (!novosExcluidos.includes(c.id)) {
          novosExcluidos.push(c.id)
        }
      })
    } else {
      // Adicionar todos Casa e Loja
      const todosIds = [...dados.centrosCustoCasa.map(c => c.id), ...dados.centrosCustoLoja.map(c => c.id)]
      todosIds.forEach(id => {
        if (!novosExcluidos.includes(id)) {
          novosExcluidos.push(id)
        }
      })
    }

    const novaConfig = { ...config, centrosExcluidos: novosExcluidos }
    salvarConfig(novaConfig)
  }

  const handleCampoChange = (campo: keyof DashboardConfig, valor: any) => {
    const novaConfig = { ...config, [campo]: valor }
    salvarConfig(novaConfig)
  }

  if (carregando) {
    return <div className="text-center p-4 text-xs text-gray-500">Carregando centros de custo...</div>
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="bg-blue-600 px-4 py-2 text-white flex justify-between items-center">
        <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
          📊 Personalização do Dashboard
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {mensagemSucesso && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-1.5 rounded text-xs font-semibold animate-pulse">
            ✓ {mensagemSucesso}
          </div>
        )}

        <p className="text-xs text-gray-600 leading-relaxed">
          Defina quais informações padrão serão mostradas no Dashboard principal da Loja. As configurações são aplicadas automaticamente ao alterar.
        </p>

        {/* Filtros de Configuração Geral */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Contexto Padrão</label>
            <select
              value={config.context}
              onChange={(e) => handleCampoChange('context', e.target.value)}
              className="block w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ambos">Ambos (Casa + Loja)</option>
              <option value="casa">Apenas Casa</option>
              <option value="loja">Apenas Loja</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Visão Inicial</label>
            <select
              value={config.tipoPadrao}
              onChange={(e) => handleCampoChange('tipoPadrao', e.target.value)}
              className="block w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="saida">🛑 Despesas (Saídas)</option>
              <option value="entrada">🟢 Receitas (Entradas)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Filtro de Status</label>
            <select
              value={config.status}
              onChange={(e) => handleCampoChange('status', e.target.value)}
              className="block w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="todos">Todos (Previstos + Realizados)</option>
              <option value="realizado">Apenas Pagos (Realizados)</option>
              <option value="previsto">Apenas Pendentes (Previstos)</option>
            </select>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Seleção de Centros de Custo */}
        <div>
          <h4 className="text-xs font-bold text-gray-800 mb-2 uppercase tracking-wide">
            Visibilidade dos Centros de Custo no Dashboard
          </h4>
          <p className="text-[11px] text-gray-500 mb-3">
            Desmarque os centros de custo que você NÃO deseja que apareçam no Dashboard.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Seção Casa */}
            <div className="bg-gray-50 p-2.5 rounded border border-gray-100">
              <div className="flex justify-between items-center mb-2 pb-1 border-b border-gray-200">
                <span className="text-xs font-bold text-green-700 flex items-center gap-1">
                  🏠 Centros de Custo - Casa
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleMarcarTodos('casa')}
                    className="text-[10px] text-blue-600 hover:underline font-semibold"
                  >
                    Exibir Todos
                  </button>
                  <span className="text-gray-300 text-[10px]">|</span>
                  <button
                    onClick={() => handleDesmarcarTodos('casa')}
                    className="text-[10px] text-red-600 hover:underline font-semibold"
                  >
                    Ocultar Todos
                  </button>
                </div>
              </div>

              {dados.centrosCustoCasa.length === 0 ? (
                <div className="text-[11px] text-gray-400 py-2">Nenhum centro de custo de Casa cadastrado.</div>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                  {dados.centrosCustoCasa.map((centro) => {
                    const incluso = !config.centrosExcluidos.includes(centro.id)
                    return (
                      <label
                        key={centro.id}
                        className="flex items-center gap-2 px-2 py-1 rounded bg-white border border-gray-100 hover:bg-gray-100 cursor-pointer transition-all"
                      >
                        <input
                          type="checkbox"
                          checked={incluso}
                          onChange={() => handleToggleCentro(centro.id)}
                          className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                        />
                        <span className="text-xs text-gray-700 font-medium truncate">
                          {centro.nome} <span className="text-[10px] text-gray-400">({centro.tipo || 'GERAL'})</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Seção Loja */}
            <div className="bg-gray-50 p-2.5 rounded border border-gray-100">
              <div className="flex justify-between items-center mb-2 pb-1 border-b border-gray-200">
                <span className="text-xs font-bold text-purple-700 flex items-center gap-1">
                  🏪 Centros de Custo - Loja
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleMarcarTodos('loja')}
                    className="text-[10px] text-blue-600 hover:underline font-semibold"
                  >
                    Exibir Todos
                  </button>
                  <span className="text-gray-300 text-[10px]">|</span>
                  <button
                    onClick={() => handleDesmarcarTodos('loja')}
                    className="text-[10px] text-red-600 hover:underline font-semibold"
                  >
                    Ocultar Todos
                  </button>
                </div>
              </div>

              {dados.centrosCustoLoja.length === 0 ? (
                <div className="text-[11px] text-gray-400 py-2">Nenhum centro de custo de Loja cadastrado.</div>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                  {dados.centrosCustoLoja.map((centro) => {
                    const incluso = !config.centrosExcluidos.includes(centro.id)
                    return (
                      <label
                        key={centro.id}
                        className="flex items-center gap-2 px-2 py-1 rounded bg-white border border-gray-100 hover:bg-gray-100 cursor-pointer transition-all"
                      >
                        <input
                          type="checkbox"
                          checked={incluso}
                          onChange={() => handleToggleCentro(centro.id)}
                          className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                        />
                        <span className="text-xs text-gray-700 font-medium truncate">
                          {centro.nome} <span className="text-[10px] text-gray-400">({centro.tipo || 'GERAL'})</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={() => {
              setSalvando(true)
              setTimeout(() => {
                setSalvando(false)
                setMensagemSucesso('Configurações salvas e aplicadas!')
                setTimeout(() => setMensagemSucesso(''), 3000)
              }, 400)
            }}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded text-xs uppercase tracking-wide shadow transition-colors"
          >
            {salvando ? 'Salvando...' : '💾 Salvar Configurações'}
          </button>
        </div>
      </div>
    </div>
  )
}
