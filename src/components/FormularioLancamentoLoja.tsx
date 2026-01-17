'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil, prepararDataParaInsert } from '@/lib/dateUtils'

interface FormularioLancamentoLojaProps {
  onLancamentoAdicionado: () => void
  onCancel: () => void
}

export default function FormularioLancamentoLoja({ onLancamentoAdicionado, onCancel }: FormularioLancamentoLojaProps) {
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState(0)
  const [data, setData] = useState(getDataAtualBrasil())
  const [tipo, setTipo] = useState('saida') // 'saida' or 'entrada'
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')

    if (!descricao.trim()) {
      setErro('A descrição é obrigatória.')
      return
    }
    if (valor <= 0) {
      setErro('O valor deve ser maior que zero.')
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado.')

      const numeroTransacao = Date.now() + Math.floor(Math.random() * 1000)

      const dadosInsert = {
        user_id: user.id,
        numero_transacao: numeroTransacao,
        descricao: descricao.trim(),
        total: valor,
        tipo: tipo,
        data: prepararDataParaInsert(data),
        status_pagamento: 'pago', // Lançamentos avulsos são sempre 'pago'
        quantidade_parcelas: 1,
      }

      const { error } = await supabase
        .from('transacoes_loja')
        .insert(dadosInsert)

      if (error) {
        throw error
      }

      // Limpar formulário e notificar o componente pai
      setDescricao('')
      setValor(0)
      setData(getDataAtualBrasil())
      setTipo('saida')
      onLancamentoAdicionado()

    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-3 space-y-2 border border-gray-200">
      <h2 className="text-sm font-semibold text-gray-800 mb-2">Novo Lançamento Avulso</h2>

      {erro && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded text-xs">
          {erro}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Descrição *
          </label>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Pagamento de conta de luz"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-1">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Valor *
            </label>
            <input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Data *
            </label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Tipo *
            </label>
            <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="saida">Saída / Despesa</option>
                <option value="entrada">Entrada / Receita</option>
            </select>
        </div>

        <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-1.5 rounded-lg font-semibold text-xs transition-colors"
            >
              {loading ? 'Salvando...' : 'Salvar Lançamento'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-1.5 rounded-lg font-semibold text-xs transition-colors"
            >
              Cancelar
            </button>
        </div>
      </form>
    </div>
  )
}
