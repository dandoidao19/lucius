'use client'

import { useState } from 'react'
import { getDataAtualBrasil } from '@/lib/dateUtils'

interface FiltrosLancamentosCasaProps {
  filtroDataInicio: string
  setFiltroDataInicio: (value: string) => void
  filtroDataFim: string
  setFiltroDataFim: (value: string) => void
  filtroMes: string
  setFiltroMes: (value: string) => void
  filtroNumeroTransacao: string
  setFiltroNumeroTransacao: (value: string) => void
  filtroDescricao: string
  setFiltroDescricao: (value: string) => void
  filtroTipo: string
  setFiltroTipo: (value: string) => void
  filtroStatus: string
  setFiltroStatus: (value: string) => void
  onLimpar: () => void
  onGerarPDF: () => void
  mostrarCDC?: boolean
  mostrarNumeroTransacao?: boolean
  mostrarTipo?: boolean
  labelsDataComoVencimento?: boolean
  titulo?: string
  tipo?: string
}

export default function FiltrosLancamentosCasa({
  filtroDataInicio,
  setFiltroDataInicio,
  filtroDataFim,
  setFiltroDataFim,
  filtroMes,
  setFiltroMes,
  filtroNumeroTransacao,
  setFiltroNumeroTransacao,
  filtroDescricao,
  setFiltroDescricao,
  filtroTipo,
  setFiltroTipo,
  filtroStatus,
  setFiltroStatus,
  onLimpar,
  onGerarPDF,
  mostrarCDC = false,
  mostrarNumeroTransacao = true,
  mostrarTipo = true,
  labelsDataComoVencimento = true,
  titulo = "Filtros de Financeiro - Casa",
  tipo = "geral"
}: FiltrosLancamentosCasaProps) {

  // ✅ FUNÇÃO para definir filtro rápido dos últimos 10 dias (Casa)
  const definirUltimos10Dias = () => {
    const hoje = new Date()
    const fim = hoje.toISOString().split('T')[0]

    const inicio = new Date(hoje)
    inicio.setDate(hoje.getDate() - 10)
    const inicioStr = inicio.toISOString().split('T')[0]

    setFiltroDataInicio(inicioStr)
    setFiltroDataFim(fim)
    setFiltroMes('')
    setFiltroNumeroTransacao('')
    setFiltroDescricao('')
    setFiltroTipo('todos')
    setFiltroStatus('todos')

    console.log(`🏠 Casa - Filtro rápido: Últimos 10 dias (${inicioStr} até ${fim})`)
  }

  // ✅ FUNÇÃO para definir filtro rápido do mês atual (Casa)
  const definirMesAtual = () => {
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = String(hoje.getMonth() + 1).padStart(2, '0')

    const primeiroDia = `${ano}-${mes}-01`
    const ultimoDia = new Date(ano, hoje.getMonth() + 1, 0).getDate()
    const ultimoDiaStr = `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`

    setFiltroDataInicio(primeiroDia)
    setFiltroDataFim(ultimoDiaStr)
    setFiltroMes(`${ano}-${mes}`)
    setFiltroNumeroTransacao('')
    setFiltroDescricao('')
    setFiltroTipo('todos')
    setFiltroStatus('todos')

    console.log(`🏠 Casa - Filtro rápido: Mês Atual (${primeiroDia} até ${ultimoDiaStr})`)
  }

  // ✅ FUNÇÃO para definir filtro rápido de hoje (Casa)
  const definirHoje = () => {
    const hoje = getDataAtualBrasil()
    setFiltroDataInicio(hoje)
    setFiltroDataFim(hoje)
    setFiltroMes('')
    setFiltroNumeroTransacao('')
    setFiltroDescricao('')
    setFiltroTipo('todos')
    setFiltroStatus('todos')

    console.log(`🏠 Casa - Filtro rápido: Hoje (${hoje})`)
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-3 space-y-2">
      <h2 className="text-sm font-semibold text-gray-800 mb-2">{titulo}</h2>

      {/* ✅ FILTROS RÁPIDOS ESPECÍFICOS PARA CASA */}
      <div className="flex flex-wrap gap-1 mb-2">
        <button
          onClick={definirUltimos10Dias}
          className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
        >
          📅 Últimos 10 Dias
        </button>
        <button
          onClick={definirMesAtual}
          className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
        >
          📊 Mês Atual
        </button>
        <button
          onClick={definirHoje}
          className="px-2 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600 transition-colors"
        >
          🎯 Hoje
        </button>
        <button
          onClick={onLimpar}
          className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
        >
          🧹 Limpar
        </button>
        <button
          onClick={onGerarPDF}
          className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
        >
          📄 Gerar PDF
        </button>
      </div>

      {/* FILTROS MANUAIS (mesmo layout) */}
      <div className="grid grid-cols-2 gap-2">
        {/* ... (mesmo conteúdo dos filtros manuais do arquivo anterior) ... */}
      </div>
    </div>
  )
}