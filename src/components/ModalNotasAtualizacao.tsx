'use client'

import { useState, useEffect } from 'react'
import { X, Rocket, Package, CreditCard, BarChart3, MousePointer2, ShieldCheck, RefreshCw } from 'lucide-react'

export default function ModalNotasAtualizacao() {
  const [aberto, setAberto] = useState(false)
  const VERSAO_ATUAL = '5.1'

  useEffect(() => {
    const versaoVisualizada = localStorage.getItem('lucius_versao_notas_lida')
    if (versaoVisualizada !== VERSAO_ATUAL) {
      setAberto(true)
    }
  }, [])

  const fechar = () => {
    localStorage.setItem('lucius_versao_notas_lida', VERSAO_ATUAL)
    setAberto(false)
  }

  if (!aberto) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-blue-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-6 py-4 flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Rocket size={80} />
          </div>
          <div className="relative z-10">
            <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <Rocket className="text-yellow-300" /> Novidades do Sistema
            </h2>
            <p className="text-blue-100 text-sm font-medium">LUCIUS v{VERSAO_ATUAL} — A evolução da sua gestão</p>
          </div>
          <button
            onClick={fechar}
            className="hover:bg-white/20 p-2 rounded-full transition-colors relative z-10"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-8 bg-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* 1. Acréscimos e Descontos */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all group">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-3 group-hover:scale-110 transition-transform">
                <Package size={24} />
              </div>
              <h3 className="font-bold text-slate-800 text-lg mb-1 uppercase tracking-tighter">Acréscimos & Descontos</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Novo controle de taxas e descontos diretamente no total da transação, sem alterar o preço unitário dos itens. Transparência total!
              </p>
            </div>

            {/* 2. Prévia do Parcelamento */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-green-300 transition-all group">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600 mb-3 group-hover:scale-110 transition-transform">
                <CreditCard size={24} />
              </div>
              <h3 className="font-bold text-slate-800 text-lg mb-1 uppercase tracking-tighter">Prévia do Parcelamento</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Visualize datas e valores de todas as parcelas antes mesmo de salvar. Maior controle sobre o fluxo de caixa planejado.
              </p>
            </div>

            {/* 3. Estoque */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-orange-300 transition-all group">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 mb-3 group-hover:scale-110 transition-transform">
                <BarChart3 size={24} />
              </div>
              <h3 className="font-bold text-slate-800 text-lg mb-1 uppercase tracking-tighter">Automação de Estoque</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Valores de custo e venda agora são atualizados automaticamente ao registrar compras, incluindo a data do último abastecimento.
              </p>
            </div>

            {/* 4. Navegação */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-purple-300 transition-all group">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 mb-3 group-hover:scale-110 transition-transform">
                <MousePointer2 size={24} />
              </div>
              <h3 className="font-bold text-slate-800 text-lg mb-1 uppercase tracking-tighter">Memória de Navegação</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Filtros inteligentes e abas ativas que persistem mesmo se você trocar de página ou módulo. Menos cliques, mais agilidade.
              </p>
            </div>

            {/* 5. Segurança */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-red-300 transition-all group">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-red-600 mb-3 group-hover:scale-110 transition-transform">
                <ShieldCheck size={24} />
              </div>
              <h3 className="font-bold text-slate-800 text-lg mb-1 uppercase tracking-tighter">Integridade Total</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Exclusão robusta com reversão garantida de estoque e financeiro. Numeração sequencial sólida para evitar duplicidades.
              </p>
            </div>

            {/* 6. Refinamento de UI */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-pink-300 transition-all group">
              <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center text-pink-600 mb-3 group-hover:scale-110 transition-transform">
                <RefreshCw size={24} />
              </div>
              <h3 className="font-bold text-slate-800 text-lg mb-1 uppercase tracking-tighter">Refinamento de UI</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Melhor visualização das parcelas e novos botões de cancelamento em fluxos rápidos para uma navegação mais segura e intuitiva.
              </p>
            </div>

          </div>

          <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-center">
            <p className="text-blue-800 text-sm italic">
              "Continuamos trabalhando para tornar o Lucius a ferramenta definitiva para o seu negócio."
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t flex justify-center">
          <button
            onClick={fechar}
            className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest px-12 py-3 rounded-xl shadow-lg hover:shadow-blue-500/30 transition-all active:scale-95"
          >
            ENTENDI, VAMOS LÁ!
          </button>
        </div>
      </div>
    </div>
  )
}
