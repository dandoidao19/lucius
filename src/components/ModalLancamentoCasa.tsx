'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil } from '@/lib/dateUtils'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'

interface ModalLancamentoCasaProps {
  aberto: boolean
  onClose: () => void
}

const CAIXA_ID_CASA = '69bebc06-f495-4fed-b0b1-beafb50c017b'

export default function ModalLancamentoCasa({ aberto, onClose }: ModalLancamentoCasaProps) {
  const { dados, recarregarDados } = useDadosFinanceiros()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    descricao: '',
    valor: '',
    tipo: 'saida',
    centroCustoId: '',
    data: getDataAtualBrasil(),
    status: 'previsto',
    parcelas: 1,
    prazoParcelas: 'mensal',
  })

  if (!aberto) return null

  const centrosCustoFiltrados = dados.centrosCustoCasa.filter(centro => {
    return form.tipo === 'entrada' ? centro.tipo === 'RECEITA' : centro.tipo === 'DESPESA'
  })

  const handleSubmit = async (e: React.FormEvent) => {
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
      const valorParcela = valorNumerico / form.parcelas

      const lancamentos = []
      for (let i = 1; i <= form.parcelas; i++) {
        let dataParcela = form.data
        if (i > 1) {
          const dt = new Date(form.data + 'T12:00:00')
          if (form.prazoParcelas === 'diaria') dt.setDate(dt.getDate() + (i - 1))
          else if (form.prazoParcelas === 'mensal') dt.setMonth(dt.getMonth() + (i - 1))
          dataParcela = dt.toISOString().split('T')[0]
        }

        lancamentos.push({
          user_id: user.id,
          descricao: form.parcelas > 1 ? `${form.descricao.toUpperCase()} (${i}/${form.parcelas})` : form.descricao.toUpperCase(),
          valor: valorParcela,
          tipo: form.tipo,
          centro_custo_id: form.centroCustoId,
          data_lancamento: form.status === 'pago' ? getDataAtualBrasil() : dataParcela,
          data_prevista: dataParcela,
          status: form.status === 'pago' ? 'realizado' : 'previsto',
          caixa_id: CAIXA_ID_CASA,
        })
      }

      const { error } = await supabase.from('lancamentos_financeiros').insert(lancamentos)
      if (error) throw error

      alert('✅ Lançamento Casa realizado!')
      recarregarDados()
      onClose()
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden border border-blue-200">
        <div className="bg-blue-600 px-4 py-2 flex justify-between items-center text-white">
          <h2 className="font-bold text-sm uppercase tracking-wider">Novo Lançamento Casa</h2>
          <button onClick={onClose} className="text-lg">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <input
            type="text"
            placeholder="Descrição *"
            className="w-full border border-gray-300 p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
            value={form.descricao}
            onChange={e => setForm({...form, descricao: e.target.value})}
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="0.01"
              placeholder="Valor Total *"
              className="w-full border border-gray-300 p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
              value={form.valor}
              onChange={e => setForm({...form, valor: e.target.value})}
              required
            />
            <input
              type="date"
              className="w-full border border-gray-300 p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
              value={form.data}
              onChange={e => setForm({...form, data: e.target.value})}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              className="w-full border border-gray-300 p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
              value={form.tipo}
              onChange={e => setForm({...form, tipo: e.target.value})}
            >
              <option value="saida">Saída</option>
              <option value="entrada">Entrada</option>
            </select>
            <select
              className="w-full border border-gray-300 p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
              value={form.status}
              onChange={e => setForm({...form, status: e.target.value})}
            >
              <option value="previsto">Previsto</option>
              <option value="pago">Pago</option>
            </select>
          </div>
          <select
            className="w-full border border-gray-300 p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
            value={form.centroCustoId}
            onChange={e => setForm({...form, centroCustoId: e.target.value})}
            required
          >
            <option value="">Selecione o Centro de Custo *</option>
            {centrosCustoFiltrados.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Parcelas"
              min="1"
              className="w-full border border-gray-300 p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
              value={form.parcelas}
              onChange={e => setForm({...form, parcelas: parseInt(e.target.value) || 1})}
            />
            <select
              className="w-full border border-gray-300 p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
              value={form.prazoParcelas}
              onChange={e => setForm({...form, prazoParcelas: e.target.value})}
              disabled={form.parcelas <= 1}
            >
              <option value="diaria">Diária</option>
              <option value="mensal">Mensal</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-1.5 rounded font-bold hover:bg-blue-700 disabled:bg-gray-400 text-xs uppercase"
          >
            {loading ? 'Salvando...' : 'Adicionar Lançamento'}
          </button>
        </form>
      </div>
    </div>
  )
}
