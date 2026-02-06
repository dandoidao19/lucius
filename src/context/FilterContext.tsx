'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

interface FiltersLojaTransacoes {
  dataInicio: string
  dataFim: string
  numero: string
  entidade: string
  tipo: string
  status: string
}

interface FiltersLojaFinanceiro {
  dataInicio: string
  dataFim: string
  mes: string
  numeroTransacao: string
  descricao: string
  tipo: string
  status: string
  verTodas: boolean
}

interface FiltersCasa {
  dataInicio: string
  dataFim: string
  mes: string
  descricao: string
  cdc: string
  status: string
  mostrarTodos: boolean
}

interface FilterContextType {
  filtersLojaTransacoes: FiltersLojaTransacoes
  setFiltersLojaTransacoes: React.Dispatch<React.SetStateAction<FiltersLojaTransacoes>>
  filtersLojaFinanceiro: FiltersLojaFinanceiro
  setFiltersLojaFinanceiro: React.Dispatch<React.SetStateAction<FiltersLojaFinanceiro>>
  filtersCasa: FiltersCasa
  setFiltersCasa: React.Dispatch<React.SetStateAction<FiltersCasa>>
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filtersLojaTransacoes, setFiltersLojaTransacoes] = useState<FiltersLojaTransacoes>({
    dataInicio: '',
    dataFim: '',
    numero: '',
    entidade: '',
    tipo: 'todos',
    status: 'todos',
  })

  const [filtersLojaFinanceiro, setFiltersLojaFinanceiro] = useState<FiltersLojaFinanceiro>({
    dataInicio: '',
    dataFim: '',
    mes: '',
    numeroTransacao: '',
    descricao: '',
    tipo: 'todos',
    status: 'todos',
    verTodas: false,
  })

  const [filtersCasa, setFiltersCasa] = useState<FiltersCasa>({
    dataInicio: '',
    dataFim: '',
    mes: '',
    descricao: '',
    cdc: '',
    status: '',
    mostrarTodos: false,
  })

  return (
    <FilterContext.Provider value={{
      filtersLojaTransacoes, setFiltersLojaTransacoes,
      filtersLojaFinanceiro, setFiltersLojaFinanceiro,
      filtersCasa, setFiltersCasa
    }}>
      {children}
    </FilterContext.Provider>
  )
}

export function useFilters() {
  const context = useContext(FilterContext)
  if (context === undefined) {
    throw new Error('useFilters deve ser usado dentro de um FilterProvider')
  }
  return context
}
