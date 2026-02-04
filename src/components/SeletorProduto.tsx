'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface Produto {
  id: string
  codigo: string
  descricao: string
  quantidade: number
  preco_custo: number
  preco_venda: number
  categoria: string
}

interface SeletorProdutoProps {
  onSelecionarProduto: (produto: Produto) => void
  onNovoItem?: () => void
  placeholder?: string
  descricaoPreenchida?: string
}

export default function SeletorProduto({
  onSelecionarProduto,
  onNovoItem,
  placeholder = 'Buscar ou criar...',
  descricaoPreenchida = '',
}: SeletorProdutoProps) {
  const [busca, setBusca] = useState(descricaoPreenchida)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const [loading, setLoading] = useState(false)

  const ignorarBuscaRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sincronizar busca com prop externa (ex: ao limpar form ou selecionar outro item)
  useEffect(() => {
    if (descricaoPreenchida !== busca) {
      setBusca(descricaoPreenchida)
      ignorarBuscaRef.current = true
    }
  }, [descricaoPreenchida])

  const buscarProdutos = useCallback(async (termo: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .or(`descricao.ilike.%${termo}%,codigo.ilike.%${termo}%`)
        .limit(10)

      if (error) throw error
      setProdutos(data || [])
      // Apenas mostra se ainda houver texto e não tiver sido ignorado
      if (busca.length > 2 && !ignorarBuscaRef.current) {
        setMostrarSugestoes(true)
      }
    } catch (error) {
      console.error('Erro ao buscar produtos:', error)
    } finally {
      setLoading(false)
    }
  }, [busca])

  // Efeito de busca com debounce
  useEffect(() => {
    if (ignorarBuscaRef.current) {
      ignorarBuscaRef.current = false
      setMostrarSugestoes(false)
      return
    }

    if (busca.length > 2) {
      const timer = setTimeout(() => {
        buscarProdutos(busca)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setProdutos([])
      setMostrarSugestoes(false)
    }
  }, [busca, buscarProdutos])

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMostrarSugestoes(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])


  const handleSelecionarProduto = (produto: Produto) => {
    ignorarBuscaRef.current = true
    setBusca(produto.descricao)
    setMostrarSugestoes(false)
    setProdutos([])
    onSelecionarProduto(produto)
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex gap-1">
        <div className="flex-1 relative">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onFocus={() => busca.length > 2 && produtos.length > 0 && setMostrarSugestoes(true)}
            placeholder={placeholder}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          {mostrarSugestoes && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 max-h-48 overflow-y-auto">
              {loading ? (
                <div className="p-2 text-gray-600 text-xs italic">Buscando...</div>
              ) : produtos.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {produtos.map((produto) => (
                    <button
                      key={produto.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault() // Evita que o input perca o foco e dispare blur antes do clique
                        handleSelecionarProduto(produto)
                      }}
                      className="w-full text-left px-2 py-1.5 hover:bg-blue-50 transition-colors text-xs"
                    >
                      <div className="font-semibold text-gray-800 truncate">{produto.descricao}</div>
                      <div className="text-[10px] text-gray-500">
                        {produto.codigo} • Est: {produto.quantidade} • R$ {produto.preco_venda.toFixed(2)}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {onNovoItem && (
          <button
            type="button"
            onClick={onNovoItem}
            className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-semibold transition-colors whitespace-nowrap"
          >
            + Novo
          </button>
        )}
      </div>
    </div>
  )
}
