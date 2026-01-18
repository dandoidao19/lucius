'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil, prepararDataParaInsert } from '@/lib/dateUtils'

interface Transacao {
  id: string
  descricao: string
  cliente_fornecedor?: string
  valor: number
  data: string
  tipo: 'entrada' | 'saida'
  valor_pago?: number | null
  status_pagamento?: string | null
}

interface FormularioLancamentoLojaProps {
  onLancamentoAdicionado: () => void
  onCancel: () => void
  lancamentoInicial?: Transacao | null
}

export default function FormularioLancamentoLoja({ onLancamentoAdicionado, onCancel, lancamentoInicial }: FormularioLancamentoLojaProps) {
  const [descricao, setDescricao] = useState('')
  const [clienteFornecedor, setClienteFornecedor] = useState('')
  const [valor, setValor] = useState(0)
  const [data, setData] = useState(getDataAtualBrasil())
  const [tipo, setTipo] = useState('saida')
  const [statusPagamento, setStatusPagamento] = useState('pendente')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const isEditMode = !!lancamentoInicial

  useEffect(() => {
    if (isEditMode && lancamentoInicial) {
      setDescricao(lancamentoInicial.descricao || '')
      setClienteFornecedor(lancamentoInicial.cliente_fornecedor || '')
      setValor(lancamentoInicial.valor_pago ?? lancamentoInicial.valor)
      setData(lancamentoInicial.data)
      setTipo(lancamentoInicial.tipo)
      setStatusPagamento(lancamentoInicial.status_pagamento || 'pendente')
    } else {
      setDescricao('')
      setClienteFornecedor('')
      setValor(0)
      setData(getDataAtualBrasil())
      setTipo('saida')
      setStatusPagamento('pendente')
    }
  }, [lancamentoInicial, isEditMode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')

    if (!descricao.trim() && !clienteFornecedor.trim()) {
      setErro('É necessário preencher a descrição ou o cliente/fornecedor.')
      return
    }
    if (valor <= 0) {
      setErro('O valor deve ser maior que zero.')
      return
    }

    setLoading(true)

    try {
      // Combina cliente/fornecedor e descrição para uma descrição completa.
      const descricaoCompleta = `${clienteFornecedor.trim()} ${descricao.trim()}`.trim()

      const dadosBase = {
        descricao: descricaoCompleta,
        total: valor,
        tipo: tipo,
        data: prepararDataParaInsert(data),
        status_pagamento: statusPagamento,
        data_pagamento: statusPagamento === 'pago' ? prepararDataParaInsert(getDataAtualBrasil()) : null,
        valor_pago: statusPagamento === 'pago' ? valor : null,
      }

      if (isEditMode && lancamentoInicial) {
        // Lógica de Atualização
        const { error } = await supabase
          .from('transacoes_loja')
          .update(dadosBase)
          .eq('id', lancamentoInicial.id)
        if (error) throw error
      } else {
        // Lógica de Inserção
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Usuário não autenticado.')
        const numeroTransacao = Date.now()
        const dadosInsert = {
          ...dadosBase,
          user_id: user.id,
          numero_transacao: numeroTransacao,
          quantidade_parcelas: 1,
        }
        const { error } = await supabase
          .from('transacoes_loja')
          .insert(dadosInsert)
        if (error) throw error
      }

      onLancamentoAdicionado()

    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-3 space-y-2 border border-blue-300">
      <h2 className="text-sm font-semibold text-gray-800 mb-2">
        {isEditMode ? 'Editar Lançamento' : 'Novo Lançamento Avulso'}
      </h2>

      {erro && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded text-xs">
          {erro}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Cliente/Fornecedor
          </label>
          <input
            type="text"
            value={clienteFornecedor}
            onChange={(e) => setClienteFornecedor(e.target.value)}
            placeholder="Nome do cliente ou fornecedor"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Descrição / Detalhes *
          </label>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Referente ao serviço X"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
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
              Vencimento *
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

        <div className="grid grid-cols-2 gap-2">
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
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Status *
            </label>
            <select
                value={statusPagamento}
                onChange={(e) => setStatusPagamento(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-1.5 rounded-lg font-semibold text-xs transition-colors"
            >
              {loading ? 'Salvando...' : (isEditMode ? 'Salvar Alterações' : 'Salvar Lançamento')}
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
