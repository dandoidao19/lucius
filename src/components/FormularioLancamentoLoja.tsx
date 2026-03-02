'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil, prepararDataParaInsert, calcularDataPorPrazo, isDataValida } from '@/lib/dateUtils'
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
  const [acrescimoDesconto, setAcrescimoDesconto] = useState(0)
  const [data, setData] = useState(getDataAtualBrasil())
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(1)
  const [prazoParcelas, setPrazoParcelas] = useState('mensal')
  const [tipo, setTipo] = useState('saida')
  const [statusPagamento, setStatusPagamento] = useState('pendente')
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
      setObservacao(lancamentoInicial.observacao || '')
    } else {
      const draft = getDraft('financeiro')
      if (draft) {
        setClienteFornecedor(draft.clienteFornecedor)
        setValor(draft.valor)
        setData(draft.data)
        setTipo(draft.tipo)
        setStatusPagamento(draft.statusPagamento)
        setObservacao(draft.observacao)
      } else {
        setClienteFornecedor('')
        setValor(0)
        setData(getDataAtualBrasil())
        setTipo('saida')
        setStatusPagamento('pendente')
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
        observacao
      })
    }
  }, [isEditMode, clienteFornecedor, valor, data, tipo, statusPagamento, observacao, setDraft])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')

    if (!clienteFornecedor.trim()) {
      setErro('O campo Cliente/Fornecedor é obrigatório.')
      return
    }
    const valorFinal = valor + acrescimoDesconto
    if (valorFinal <= 0) {
      setErro('O valor total deve ser maior que zero.')
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado.')

      const valorBase = Math.ceil((valorFinal / quantidadeParcelas) * 100) / 100
      const valorUltima = Number((valorFinal - (valorBase * (quantidadeParcelas - 1))).toFixed(2))

      if (isEditMode && lancamentoInicial) {
        const dadosBase = {
          descricao: clienteFornecedor.trim(),
          total: valorFinal,
          tipo: tipo,
          data: prepararDataParaInsert(data),
          status_pagamento: statusPagamento,
          data_pagamento: statusPagamento === 'pago' ? prepararDataParaInsert(getDataAtualBrasil()) : null,
          valor_pago: statusPagamento === 'pago' ? valorFinal : null,
          observacao: observacao.trim() || null,
        }
        // Lógica de Atualização
        const { error } = await supabase
          .from('transacoes_loja')
          .update(dadosBase)
          .eq('id', lancamentoInicial.id)
        if (error) throw error
      } else {
        // Obter próximo número de transação via RPC
        const { data: numeroTransacao, error: errorNumero } = await supabase.rpc('obter_proximo_numero_transacao')
        if (errorNumero) throw errorNumero

        const transacoes = []
        let dataAtualParcela = data
        for (let i = 1; i <= quantidadeParcelas; i++) {
          let dataParcela = dataAtualParcela
          if (i > 1) {
            dataParcela = calcularDataPorPrazo(dataAtualParcela, prazoParcelas)
            dataAtualParcela = dataParcela
          }

          transacoes.push({
            user_id: user.id,
            numero_transacao: numeroTransacao,
            descricao: `${clienteFornecedor.trim()} (${i}/${quantidadeParcelas})`,
            total: i === quantidadeParcelas ? valorUltima : valorBase,
            tipo: tipo,
            data: prepararDataParaInsert(dataParcela),
            status_pagamento: statusPagamento === 'pago' && i === 1 ? 'pago' : 'pendente',
            data_pagamento: statusPagamento === 'pago' && i === 1 ? prepararDataParaInsert(getDataAtualBrasil()) : null,
            valor_pago: statusPagamento === 'pago' && i === 1 ? (i === quantidadeParcelas ? valorUltima : valorBase) : null,
            observacao: observacao.trim() || null,
            quantidade_parcelas: quantidadeParcelas
          })
        }

        const { error } = await supabase.from('transacoes_loja').insert(transacoes)
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

        <div className="grid grid-cols-3 gap-2">
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
            <label className="block text-xs font-medium text-gray-700 mb-1 text-purple-600">
              Acrésc./Desc.
            </label>
            <input
              type="number"
              step="0.01"
              value={acrescimoDesconto}
              onChange={(e) => setAcrescimoDesconto(parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1 text-xs border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-purple-50/30"
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

        <div className="bg-slate-100 p-2 rounded flex justify-between items-center mb-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Total Final:</span>
          <span className="text-sm font-black text-slate-800">R$ {(valor + acrescimoDesconto).toFixed(2)}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo *</label>
            <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="saida">Saída / Despesa</option>
                <option value="entrada">Entrada / Receita</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status *</label>
            <select
                value={statusPagamento}
                onChange={(e) => setStatusPagamento(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
            </select>
          </div>
          {!isEditMode && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Parc.</label>
                <input
                  type="number"
                  min="1"
                  value={quantidadeParcelas}
                  onChange={(e) => setQuantidadeParcelas(parseInt(e.target.value) || 1)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Prazo</label>
                <select
                  value={prazoParcelas}
                  onChange={(e) => setPrazoParcelas(e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="diaria">Diária</option>
                  <option value="semanal">Semanal</option>
                  <option value="mensal">Mensal</option>
                </select>
              </div>
            </>
          )}
        </div>

        {/* Preview Parcelas Avulso */}
        {!isEditMode && quantidadeParcelas > 1 && (
          <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100 shadow-inner overflow-x-auto">
             <div className="flex gap-2 pb-1">
                {(() => {
                  const parcelasPreview = []
                  let dataPreview = data
                  const valorFinal = valor + acrescimoDesconto
                  const vBase = Math.ceil((valorFinal / quantidadeParcelas) * 100) / 100
                  const vUlt = Number((valorFinal - (vBase * (quantidadeParcelas - 1))).toFixed(2))

                  const dataBaseValida = isDataValida(data)

                  for (let i = 0; i < Math.min(quantidadeParcelas, 12); i++) {
                    const dtP = i === 0 ? dataPreview : (dataBaseValida ? calcularDataPorPrazo(dataPreview, prazoParcelas) : dataPreview)
                    if (i > 0) dataPreview = dtP

                    parcelasPreview.push(
                      <div key={i} className="min-w-[100px] bg-white border border-blue-100 rounded-lg p-2 flex flex-col shadow-sm transition-all hover:border-blue-300 group">
                        <div className="flex justify-between items-center mb-1 border-b border-blue-50 pb-1">
                          <span className="text-[10px] font-black text-blue-300 group-hover:text-blue-600 uppercase italic leading-none">{i + 1}ª</span>
                          <span className="text-[11px] font-semibold text-gray-600 leading-none">{dtP ? dtP.split('-').reverse().slice(0, 2).join('/') : '--/--'}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-blue-800">R$ {(i === quantidadeParcelas - 1 ? vUlt : vBase).toFixed(2)}</span>
                        </div>
                      </div>
                    )
                  }
                  return parcelasPreview
                })()}
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
