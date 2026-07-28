'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

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
  filtersCasa: FiltersCasa
  setFiltersCasa: React.Dispatch<React.SetStateAction<FiltersCasa>>
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

export function FilterProvider({ children }: { children: ReactNode }) {
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
      filtersCasa,
      setFiltersCasa
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
