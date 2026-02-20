'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react'

export default function ManutencaoEstoque() {
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')

  const recalcularEstoque = async () => {
    if (!window.confirm('Deseja realmente recalcular todo o estoque? Isso varrerá todas as transações de compra e venda para definir os saldos reais.')) {
      return
    }

    setLoading(true)
    setErro('')
    setSucesso(false)

    try {
      const { error } = await supabase.rpc('recalcular_estoque_geral')

      if (error) throw error

      setSucesso(true)
    } catch (err: any) {
      console.error('Erro ao recalcular estoque:', err)
      setErro(err.message || 'Erro interno ao processar recalculo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
      <div className="flex items-center gap-2 mb-4 text-slate-800">
        <RefreshCw size={20} className="text-blue-600" />
        <h2 className="text-sm font-bold uppercase tracking-tight">Manutenção de Estoque</h2>
      </div>

      <p className="text-xs text-slate-600 mb-6 leading-relaxed">
        Utilize esta ferramenta para corrigir discrepâncias nas quantidades dos produtos.
        O sistema fará uma varredura completa em todas as <strong>Vendas</strong>, <strong>Compras</strong> e <strong>Condicionais Pendentes</strong> (ignorando Pedidos) para reconstruir o saldo de cada item no banco de dados.
      </p>

      {erro && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 rounded text-red-700 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5" />
          <div className="text-xs">
            <p className="font-bold">Erro ao recalcular:</p>
            <p>{erro}</p>
            <p className="mt-2 font-semibold">Certifique-se de que a função SQL (v5.0) foi executada no seu Supabase.</p>
          </div>
        </div>
      )}

      {sucesso && (
        <div className="mb-4 bg-green-50 border-l-4 border-green-500 p-3 rounded text-green-700 flex items-center gap-2">
          <CheckCircle size={16} />
          <p className="text-xs font-bold">Estoque recalculado e corrigido com sucesso!</p>
        </div>
      )}

      <button
        onClick={recalcularEstoque}
        disabled={loading}
        className={`flex items-center justify-center gap-2 w-full py-3 rounded-lg font-black uppercase text-xs transition-all shadow-md active:scale-[0.98] ${
          loading
          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
          : 'bg-blue-600 hover:bg-blue-500 text-white'
        }`}
      >
        {loading ? (
          <>
            <RefreshCw size={16} className="animate-spin" />
            Processando Varredura...
          </>
        ) : (
          <>
            <RefreshCw size={16} />
            Recalcular Saldos de Estoque agora
          </>
        )}
      </button>

      <div className="mt-6 pt-4 border-t border-slate-100 italic text-[10px] text-slate-400 text-center">
        💡 Recomendado executar após importações massivas ou caso perceba saldos incorretos.
      </div>
    </div>
  )
}
