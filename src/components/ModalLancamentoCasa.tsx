'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil } from '@/lib/dateUtils'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'
import type { LancamentoFinanceiro } from '@/types'

interface ModalLancamentoCasaProps {
  aberto: boolean
  onClose: () => void
  lancamentoEdicao?: LancamentoFinanceiro | null
}

const CAIXA_ID_CASA = '69bebc06-f495-4fed-b0b1-beafb50c017b'

const formInicial = () => ({
  descricao: '',
  valor: '',
  tipo: 'saida',
  centroCustoId: '',
  data: getDataAtualBrasil(),
  status: 'previsto',
  parcelas: 1,
  prazoParcelas: 'mensal' as 'diaria' | 'mensal' | 'quinzenal' | 'semanal',
})

const formParaEdicao = (lancamento: LancamentoFinanceiro) => {
  const dataBase =
    (lancamento.status === 'realizado' ? lancamento.data_lancamento : lancamento.data_prevista) ||
    lancamento.data ||
    getDataAtualBrasil()

  return {
    descricao: lancamento.descricao ?? '',
    valor: String(lancamento.valor ?? ''),
    tipo: lancamento.tipo === 'entrada' ? 'entrada' : 'saida',
    centroCustoId: lancamento.centro_custo_id ?? '',
    data: dataBase.split('T')[0],
    status: lancamento.status === 'realizado' ? 'pago' : 'previsto',
    parcelas: 1,
    prazoParcelas: 'mensal' as 'diaria' | 'mensal' | 'quinzenal' | 'semanal',
  }
}

const getMensagemErro = (err: unknown) => {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const erroSupabase = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    return [erroSupabase.message, erroSupabase.details, erroSupabase.hint, erroSupabase.code]
      .filter(Boolean)
      .map(String)
      .join(' | ')
  }
  return String(err)
}

export default function ModalLancamentoCasa({ aberto, onClose, lancamentoEdicao = null }: ModalLancamentoCasaProps) {
  const { dados, recarregarDados } = useDadosFinanceiros()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [form, setForm] = useState(formInicial)

  useEffect(() => {
    if (!aberto) return
    if (lancamentoEdicao) {
      setForm(formParaEdicao(lancamentoEdicao))
    } else {
      setForm(formInicial())
    }
  }, [aberto, lancamentoEdicao])

  useEffect(() => {
    setMounted(true)
  }, [])

  const centrosCustoFiltrados = dados.centrosCustoCasa.filter(centro => {
    return form.tipo === 'entrada' ? centro.tipo === 'RECEITA' : centro.tipo === 'DESPESA'
  })

  if (!aberto || !mounted) return null

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.descricao || !form.valor || !form.centroCustoId) {
      alert('Preencha todos os campos obrigatórios')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const valorNumerico = parseFloat(form.valor)

      if (lancamentoEdicao) {
        const statusFinal = form.status === 'pago' ? 'realizado' : 'previsto'
        const dataParaLancamento = form.data
        const { error } = await supabase
          .from('lancamentos_financeiros')
          .update({
            descricao: form.descricao.toUpperCase(),
            valor: valorNumerico,
            tipo: form.tipo,
            centro_custo_id: form.centroCustoId,
            data_lancamento: dataParaLancamento,
            data_prevista: form.data,
            status: statusFinal,
            caixa_id: lancamentoEdicao.caixa_id || CAIXA_ID_CASA,
          })
          .eq('id', lancamentoEdicao.id)

        if (error) throw error

        queryClient.setQueryData<LancamentoFinanceiro[]>(['lancamentos_financeiros'], atuais =>
          (atuais ?? []).map(item =>
            item.id === lancamentoEdicao.id
              ? {
                  ...item,
                  descricao: form.descricao.toUpperCase(),
                  valor: valorNumerico,
                  tipo: form.tipo as 'entrada' | 'saida',
                  centro_custo_id: form.centroCustoId,
                  data_lancamento: dataParaLancamento,
                  data_prevista: form.data,
                  status: statusFinal,
                  caixa_id: lancamentoEdicao.caixa_id || CAIXA_ID_CASA,
                }
              : item
          )
        )
        alert('✅ Lançamento Casa atualizado!')
        setForm(formInicial())
        recarregarDados()
        onClose()
        return
      }

      const valorParcela = valorNumerico / form.parcelas

      const lancamentos = []
      for (let i = 1; i <= form.parcelas; i++) {
        let dataParcela = form.data

        if (i > 1) {
          const dt = new Date(form.data + 'T12:00:00')

          if (form.prazoParcelas === 'diaria') {
            dt.setDate(dt.getDate() + (i - 1))
          } else if (form.prazoParcelas === 'semanal') {
            dt.setDate(dt.getDate() + 7 * (i - 1))
          } else if (form.prazoParcelas === 'quinzenal') {
            dt.setDate(dt.getDate() + 14 * (i - 1))
          } else if (form.prazoParcelas === 'mensal') {
            dt.setMonth(dt.getMonth() + (i - 1))
          }

          dataParcela = dt.toISOString().split('T')[0]
        }

        lancamentos.push({
          user_id: user.id,
          descricao: form.parcelas > 1
            ? `${form.descricao.toUpperCase()} (${i}/${form.parcelas})`
            : form.descricao.toUpperCase(),
          valor: valorParcela,
          tipo: form.tipo,
          centro_custo_id: form.centroCustoId,
          data_lancamento: form.status === 'pago' ? getDataAtualBrasil() : dataParcela,
          data_prevista: dataParcela,
          status: form.status === 'pago' ? 'realizado' : 'previsto',
          caixa_id: CAIXA_ID_CASA,
        })
      }

      const { data: lancamentosInseridos, error } = await supabase
        .from('lancamentos_financeiros')
        .insert(lancamentos)
        .select('*, centros_de_custo(nome)')
      if (error) throw error

      if (lancamentosInseridos?.length) {
        queryClient.setQueryData<LancamentoFinanceiro[]>(['lancamentos_financeiros'], atuais => [
          ...(lancamentosInseridos as LancamentoFinanceiro[]),
          ...(atuais ?? []),
        ])
      }
      alert('✅ Lançamento Casa realizado!')
      setForm(formInicial())
      recarregarDados()
      onClose()
    } catch (err: unknown) {
      const msg = getMensagemErro(err)
      console.error('Erro ao salvar lançamento casa:', err)
      alert('Erro: ' + msg)
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-md rounded-xl bg-white border border-blue-200 shadow-xl overflow-hidden max-h-[calc(100vh-4rem)]">
        <div className="bg-blue-600 px-3 py-3 flex justify-between items-center text-white border-b border-blue-700">
          <h2 className="text-sm font-semibold uppercase tracking-widest flex items-center">
            {lancamentoEdicao ? 'Editar Lançamento Casa' : 'Novo Lançamento Casa'}
          </h2>
          <button
            onClick={onClose}
            className="text-lg flex items-center justify-center p-2 rounded-full hover:bg-blue-500/20 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[calc(100vh-7rem)] overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            <input
              type="text"
              placeholder="Descrição *"
              className="w-full border border-gray-300 p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
              value={form.descricao}
              onChange={e => setForm({ ...form, descricao: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="Valor Total *"
                className="w-full border border-gray-300 p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                value={form.valor}
                onChange={e => setForm({ ...form, valor: e.target.value })}
                required
              />
              <input
                type="date"
                className="w-full border border-gray-300 p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                value={form.data}
                onChange={e => setForm({ ...form, data: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                className="w-full border border-gray-300 p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                value={form.tipo}
                onChange={e => setForm({ ...form, tipo: e.target.value })}
              >
                <option value="saida">Saída</option>
                <option value="entrada">Entrada</option>
              </select>

              <select
                className="w-full border border-gray-300 p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
              >
                <option value="previsto">Previsto</option>
                <option value="pago">Pago</option>
              </select>
            </div>

            <select
              className="w-full border border-gray-300 p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
              value={form.centroCustoId}
              onChange={e => setForm({ ...form, centroCustoId: e.target.value })}
              required
            >
              <option value="">Selecione o Centro de Custo *</option>
              {centrosCustoFiltrados.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Parcelas"
                min="1"
                className="w-full border border-gray-300 p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                value={form.parcelas}
                onChange={e => setForm({ ...form, parcelas: parseInt(e.target.value) || 1 })}
                disabled={!!lancamentoEdicao}
              />

              <select
                className="w-full border border-gray-300 p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                value={form.prazoParcelas}
                onChange={e => setForm({ ...form, prazoParcelas: e.target.value as typeof form.prazoParcelas })}
                disabled={!!lancamentoEdicao || form.parcelas <= 1}
              >
                <option value="diaria">Diária</option>
                <option value="mensal">Mensal</option>
                <option value="quinzenal">Quinzenal</option>
                <option value="semanal">Semanal</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-1.5 rounded font-bold hover:bg-blue-700 disabled:bg-gray-400 text-xs uppercase"
            >
              {loading ? 'Salvando...' : lancamentoEdicao ? 'Salvar Alterações' : 'Adicionar Lançamento'}
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  )
}
