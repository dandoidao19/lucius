'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil, prepararDataParaInsert } from '@/lib/dateUtils'
import { formatarErro } from '@/lib/errorUtils'
import { useFormDraft } from '@/context/FormDraftContext'
import SeletorEntidade from './SeletorEntidade'

interface Transacao {
  id: string
  descricao: string
  cliente_fornecedor?: string
  valor: number
  data: string
  tipo: 'entrada' | 'saida'
  valor_pago?: number | null
  status_pagamento?: string | null
  observacao?: string | null
}

interface FormularioLancamentoLojaProps {
  onLancamentoAdicionado: () => void
  onCancel: () => void
  lancamentoInicial?: Transacao | null
}

export default function FormularioLancamentoLoja({ onLancamentoAdicionado, onCancel, lancamentoInicial }: FormularioLancamentoLojaProps) {
  const { getDraft, setDraft, clearDraft } = useFormDraft()
  const [clienteFornecedor, setClienteFornecedor] = useState('')
  const [valor, setValor] = useState(0)
  const [data, setData] = useState(getDataAtualBrasil())
  const [tipo, setTipo] = useState('saida')
  const [statusPagamento, setStatusPagamento] = useState('pendente')
  const [acrescimo, setAcrescimo] = useState(0)
  const [desconto, setDesconto] = useState(0)
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const isEditMode = !!lancamentoInicial

  useEffect(() => {
    if (isEditMode && lancamentoInicial) {
      setClienteFornecedor(lancamentoInicial.descricao || lancamentoInicial.cliente_fornecedor || '')
      setValor(lancamentoInicial.valor_pago ?? lancamentoInicial.valor)
      setData(lancamentoInicial.data)
      setTipo(lancamentoInicial.tipo)
      setStatusPagamento(lancamentoInicial.status_pagamento || 'pendente')
      setAcrescimo((lancamentoInicial as any).acrescimo || 0)
      setDesconto((lancamentoInicial as any).desconto || 0)
      setObservacao(lancamentoInicial.observacao || '')
    } else {
      const draft = getDraft('financeiro')
      if (draft) {
        setClienteFornecedor(draft.clienteFornecedor)
        setValor(draft.valor)
        setData(draft.data)
        setTipo(draft.tipo)
        setStatusPagamento(draft.statusPagamento)
        setAcrescimo(draft.acrescimo || 0)
        setDesconto(draft.desconto || 0)
        setObservacao(draft.observacao)
      } else {
        setClienteFornecedor('')
        setValor(0)
        setData(getDataAtualBrasil())
        setTipo('saida')
        setStatusPagamento('pendente')
        setAcrescimo(0)
        setDesconto(0)
        setObservacao('')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lancamentoInicial, isEditMode])

  useEffect(() => {
    if (!isEditMode && clienteFornecedor) {
      setDraft('financeiro', {
        clienteFornecedor,
        valor,
        data,
        tipo,
        statusPagamento,
        acrescimo,
        desconto,
        observacao
      })
    }
  }, [isEditMode, clienteFornecedor, valor, data, tipo, statusPagamento, acrescimo, desconto, observacao, setDraft])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')

    if (!clienteFornecedor.trim()) {
      setErro('O campo Cliente/Fornecedor é obrigatório.')
      return
    }
    if (valor <= 0) {
      setErro('O valor deve ser maior que zero.')
      return
    }

    setLoading(true)

    try {
      const dadosBase = {
        descricao: clienteFornecedor.trim(),
        total: valor + acrescimo - desconto,
        acrescimo: acrescimo,
        desconto: desconto,
        tipo: tipo,
        data: prepararDataParaInsert(data),
        status_pagamento: statusPagamento,
        data_pagamento: statusPagamento === 'pago' ? prepararDataParaInsert(getDataAtualBrasil()) : null,
        valor_pago: statusPagamento === 'pago' ? (valor + acrescimo - desconto) : null,
        observacao: observacao.trim() || null,
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

        // Obter próximo número de transação via RPC para evitar erro de tipo/limite
        const { data: numeroTransacao, error: errorNumero } = await supabase.rpc('obter_proximo_numero_transacao')
        if (errorNumero) throw errorNumero

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

      if (!isEditMode) {
        clearDraft('financeiro')
      }
      onLancamentoAdicionado()

    } catch (err) {
      const msg = formatarErro(err)
      setErro(msg)
      console.error('Erro detalhado:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-purple-200">
      <div className="bg-purple-600 px-3 py-1 flex justify-between items-center text-white border-b border-purple-700">
        <h2 className="text-xs font-semibold uppercase tracking-widest">
          {isEditMode ? 'Editar Lançamento' : 'Novo Lançamento Avulso'}
        </h2>
      </div>
      <div className="p-3 space-y-2">

      {erro && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded text-xs">
          {erro}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Cliente/Fornecedor *
          </label>
          <SeletorEntidade
            valor={clienteFornecedor}
            onChange={setClienteFornecedor}
            tipo="ambos"
            placeholder="Nome do cliente ou fornecedor"
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

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Acréscimo (+)
            </label>
            <input
              type="number"
              step="0.01"
              value={acrescimo}
              onChange={(e) => setAcrescimo(parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Desconto (-)
            </label>
            <input
              type="number"
              step="0.01"
              value={desconto}
              onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Prévia do Parcelamento (Apenas se houver valor) */}
        {(valor > 0 || acrescimo > 0 || desconto > 0) && (
          <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg">
             <p className="text-xs font-bold text-purple-700 uppercase mb-1 flex items-center gap-1">
               🗓️ Detalhamento do Lançamento
             </p>
             <div className="bg-white border border-slate-100 rounded-md p-2 flex justify-between items-center shadow-sm">
                <div className="flex flex-col">
                   <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tighter">Vencimento</span>
                   <span className="text-xs font-bold text-slate-800">{data.split('-').reverse().join('/')}</span>
                </div>
                <div className="text-right flex flex-col">
                   <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tighter">Valor Final</span>
                   <span className="text-sm font-black text-purple-700">R$ {(valor + acrescimo - desconto).toFixed(2)}</span>
                </div>
             </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Observações
          </label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Notas adicionais sobre este lançamento..."
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
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
    </div>
  )
}
