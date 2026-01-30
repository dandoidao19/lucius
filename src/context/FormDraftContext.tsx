'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

interface FormDraftContextType {
  getDraft: (key: string) => any
  setDraft: (key: string, data: any) => void
  clearDraft: (key: string) => void
  hasDraft: (key: string) => boolean
  allDrafts: Record<string, any>
}

const FormDraftContext = createContext<FormDraftContextType | undefined>(undefined)

export function FormDraftProvider({ children }: { children: React.ReactNode }) {
  const [allDrafts, setAllDrafts] = useState<Record<string, any>>({})
  const isLoadedRef = useRef(false)

  // Carregar do localStorage ao montar no cliente
  useEffect(() => {
    const saved = localStorage.getItem('form_drafts')
    if (saved) {
      try {
        setAllDrafts(JSON.parse(saved))
      } catch (e) {
        console.error('Erro ao carregar rascunhos:', e)
      }
    }
    isLoadedRef.current = true
  }, [])

  // Salvar no localStorage sempre que mudar, mas só depois do load inicial
  useEffect(() => {
    if (!isLoadedRef.current) return

    if (Object.keys(allDrafts).length > 0) {
      localStorage.setItem('form_drafts', JSON.stringify(allDrafts))
    } else {
      localStorage.removeItem('form_drafts')
    }
  }, [allDrafts])

  const getDraft = useCallback((key: string) => allDrafts[key] || null, [allDrafts])

  const setDraft = useCallback((key: string, data: any) => {
    setAllDrafts(prev => {
      // Evitar atualização se os dados forem idênticos
      if (JSON.stringify(prev[key]) === JSON.stringify(data)) return prev
      return { ...prev, [key]: data }
    })
  }, [])

  const clearDraft = useCallback((key: string) => {
    setAllDrafts(prev => {
      if (!prev[key]) return prev
      const newDrafts = { ...prev }
      delete newDrafts[key]
      return newDrafts
    })
  }, [])

  const hasDraft = useCallback((key: string) => !!allDrafts[key], [allDrafts])

  return (
    <FormDraftContext.Provider value={{ getDraft, setDraft, clearDraft, hasDraft, allDrafts }}>
      {children}
    </FormDraftContext.Provider>
  )
}

export function useFormDraft() {
  const context = useContext(FormDraftContext)
  if (!context) {
    throw new Error('useFormDraft deve ser usado dentro de um FormDraftProvider')
  }
  return context
}
