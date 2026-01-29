'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface SeletorEntidadeProps {
  valor: string
  onChange: (valor: string) => void
  tipo: 'cliente' | 'fornecedor' | 'ambos'
  placeholder?: string
}

export default function SeletorEntidade({ valor, onChange, tipo, placeholder }: SeletorEntidadeProps) {
  const [sugestoes, setSugestoes] = useState<string[]>([])
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)

  useEffect(() => {
    if (valor.length > 1) {
      buscarSugestoes(valor)
    } else {
      setSugestoes([])
      setMostrarSugestoes(false)
    }
  }, [valor])

  const buscarSugestoes = async (termo: string) => {
    try {
      const results = new Set<string>()

      if (tipo === 'cliente' || tipo === 'ambos') {
        const { data: v } = await supabase.from('vendas').select('cliente').ilike('cliente', `%${termo}%`).limit(5)
        v?.forEach(item => results.add(item.cliente))

        const { data: c } = await supabase.from('transacoes_condicionais').select('origem').eq('tipo', 'enviado').ilike('origem', `%${termo}%`).limit(5)
        c?.forEach(item => results.add(item.origem))
      }

      if (tipo === 'fornecedor' || tipo === 'ambos') {
        const { data: co } = await supabase.from('compras').select('fornecedor').ilike('fornecedor', `%${termo}%`).limit(5)
        co?.forEach(item => results.add(item.fornecedor))

        const { data: c } = await supabase.from('transacoes_condicionais').select('origem').eq('tipo', 'recebido').ilike('origem', `%${termo}%`).limit(5)
        c?.forEach(item => results.add(item.origem))
      }

      setSugestoes(Array.from(results).sort())
      setMostrarSugestoes(results.size > 0)
    } catch (error) {
      console.error('Erro ao buscar sugestões de nomes:', error)
    }
  }

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => valor.length > 1 && sugestoes.length > 0 && setMostrarSugestoes(true)}
        onBlur={() => setTimeout(() => setMostrarSugestoes(false), 200)}
        placeholder={placeholder}
        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {mostrarSugestoes && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded shadow-lg z-[60] mt-1 max-h-40 overflow-y-auto">
          {sugestoes.map((sug, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onChange(sug)
                setMostrarSugestoes(false)
              }}
              className="w-full text-left px-2 py-1.5 hover:bg-blue-50 text-xs text-gray-700 border-b border-gray-50 last:border-0"
            >
              {sug}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
