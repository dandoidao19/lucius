'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, X } from 'lucide-react'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'
import { useFormDraft } from '@/context/FormDraftContext'
import SeletorProduto from './SeletorProduto'
import SeletorEntidade from './SeletorEntidade'
import { getDataAtualBrasil, prepararDataParaInsert } from '@/lib/dateUtils'

interface ItemVendaCasada {
  id_produto: string
  nome: string
  quantidade: number
  preco_unitario: number
  preco_custo: number
  percentual_repasse: number
  valor_repasse: number
}

interface ModalVendaCasadaProps {
  aberto: boolean
  onClose: () => void
  onSucesso: () => void
}

export default function ModalVendaCasada({ aberto, onClose, onSucesso }: ModalVendaCasadaProps) {
  const { dados, recarregarDados } = useDadosFinanceiros()
  const { getDraft, setDraft, clearDraft } = useFormDraft()
  const [loading, setLoading] = useState(false)
  const [etapa, setEtapa] = useState(1) // 1: Itens, 2: Pagamentos/Finalização

  // Cabeçalho
  const [cliente, setCliente] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [data, setData] = useState(getDataAtualBrasil())

  // Itens da Venda (Saída)
  const [itensVenda, setItensVenda] = useState<ItemVendaCasada[]>([
    { id_produto: '', nome: '', quantidade: 1, preco_unitario: 0, preco_custo: 0, percentual_repasse: 0, valor_repasse: 0 }
  ])

  // Itens da Compra (Entrada)
  const [itensCompra, setItensCompra] = useState<ItemVendaCasada[]>([
    { id_produto: '', nome: '', quantidade: 1, preco_unitario: 0, preco_custo: 0, percentual_repasse: 0, valor_repasse: 0 }
  ])

  useEffect(() => {
    const draft = getDraft('venda_casada')
    if (draft) {
      setCliente(draft.cliente)
      setFornecedor(draft.fornecedor)
      setData(draft.data)
      setItensVenda(draft.itensVenda)
      setItensCompra(draft.itensCompra)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (aberto && (cliente || itensVenda[0].id_produto || itensCompra[0].id_produto)) {
      setDraft('venda_casada', { cliente, fornecedor, data, itensVenda, itensCompra })
    }
  }, [aberto, cliente, fornecedor, data, itensVenda, itensCompra, setDraft])

  if (!aberto) return null

  const adicionarItemVenda = () => {
    setItensVenda([...itensVenda, { id_produto: '', nome: '', quantidade: 1, preco_unitario: 0, preco_custo: 0, percentual_repasse: 0, valor_repasse: 0 }])
  }

  const adicionarItemCompra = () => {
    setItensCompra([...itensCompra, { id_produto: '', nome: '', quantidade: 1, preco_unitario: 0, preco_custo: 0, percentual_repasse: 0, valor_repasse: 0 }])
  }

  const totalVenda = itensVenda.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario), 0)
  const totalCompra = itensCompra.reduce((acc, item) => acc + (item.quantidade * item.valor_repasse), 0)
  const diferenca = totalVenda - totalCompra

  // Pagamento Venda
  const [pagVenda, setPagVenda] = useState({ status: 'pendente', parcelas: 1, vencimento: data })
  // Pagamento Compra
  const [pagCompra, setPagCompra] = useState({ status: 'pago', parcelas: 1, vencimento: data })

  const criarFinanceiro = async (total: number, entidade: string, vencimento: string, qtd: number, tipo: 'entrada' | 'saida', refNum: number) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const valorParcela = total / qtd
    const transacoes = []
    for (let i = 1; i <= qtd; i++) {
      const numTrans = parseInt(`${Date.now().toString().slice(-6)}${i}${Math.floor(Math.random() * 10)}`)
      transacoes.push({
        user_id: user.id,
        numero_transacao: numTrans,
        descricao: `${tipo === 'entrada' ? 'Venda' : 'Compra'} Casada - ${entidade} (${i}/${qtd})`,
        total: valorParcela,
        tipo,
        data: prepararDataParaInsert(vencimento),
        status_pagamento: i === 1 && total > 0 ? (tipo === 'entrada' ? pagVenda.status : pagCompra.status) : 'pendente',
        observacao: `Ref. #${refNum}`
      })
    }
    await supabase.from('transacoes_loja').insert(transacoes)
  }

  const handleSubmit = async () => {
    if (!cliente || !fornecedor) return alert('Informe Cliente e Fornecedor')
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      // 1. Gerar Venda
      const { data: numVenda } = await supabase.rpc('obter_proximo_numero_transacao')
      const { data: venda, error: errVenda } = await supabase.from('vendas').insert({
        cliente,
        data_venda: prepararDataParaInsert(data),
        total: totalVenda,
        status_pagamento: pagVenda.status,
        user_id: user.id,
        numero_transacao: numVenda,
        observacao: `VENDA CASADA (Ref. Compra #${numVenda + 1})`
      }).select().single()
      if (errVenda) throw errVenda

      // 2. Gerar Compra
      const { data: numCompra } = await supabase.rpc('obter_proximo_numero_transacao')
      const { data: compra, error: errCompra } = await supabase.from('compras').insert({
        fornecedor,
        data_compra: prepararDataParaInsert(data),
        total: totalCompra,
        status_pagamento: pagCompra.status,
        user_id: user.id,
        numero_transacao: numCompra,
        observacao: `COMPRA CASADA (Ref. Venda #${numVenda})`
      }).select().single()
      if (errCompra) throw errCompra

      // 3. Itens Venda (Saída)
      for (const item of itensVenda.filter(i => i.id_produto)) {
        await supabase.from('itens_venda').insert({
          venda_id: venda.id,
          produto_id: item.id_produto,
          descricao: item.nome,
          quantidade: item.quantidade,
          preco_venda: item.preco_unitario,
          preco_custo: item.preco_custo,
          valor_repasse: item.valor_repasse
        })
        await supabase.rpc('atualizar_estoque', { produto_id_param: item.id_produto, quantidade_param: -item.quantidade })
        await supabase.from('movimentacoes_estoque').insert({
          produto_id: item.id_produto, tipo: 'saida', quantidade: item.quantidade, observacao: `Venda Casada #${numVenda}`
        })
      }

      // 4. Itens Compra (Entrada)
      for (const item of itensCompra.filter(i => i.id_produto)) {
        await supabase.from('itens_compra').insert({
          compra_id: compra.id,
          produto_id: item.id_produto,
          descricao: item.nome,
          quantidade: item.quantidade,
          preco_custo: item.preco_custo,
          valor_repasse: item.valor_repasse,
          preco_venda: item.preco_unitario
        })
        await supabase.rpc('atualizar_estoque', { produto_id_param: item.id_produto, quantidade_param: item.quantidade })
        await supabase.from('movimentacoes_estoque').insert({
          produto_id: item.id_produto, tipo: 'entrada', quantidade: item.quantidade, observacao: `Compra Casada #${numCompra}`
        })
      }

      // 5. Financeiro
      await criarFinanceiro(totalVenda, cliente, pagVenda.vencimento, pagVenda.parcelas, 'entrada', numVenda)
      await criarFinanceiro(totalCompra, fornecedor, pagCompra.vencimento, pagCompra.parcelas, 'saida', numCompra)

      alert('✅ Venda Casada gerada com sucesso!')
      clearDraft('venda_casada')
      recarregarDados()
      onSucesso()
      onClose()
    } catch (error: any) {
      alert('Erro: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[50] p-4 overflow-y-auto">
      <div className="bg-slate-50 w-full max-w-4xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-800 text-white p-4 flex justify-between items-center rounded-t-xl">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span>🤝</span> Venda Casada (Troca/Parte de Pagamento)
          </h2>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Dados Gerais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cliente (Venda)</label>
              <SeletorEntidade
                valor={cliente}
                onChange={setCliente}
                tipo="cliente"
                placeholder="Nome do Cliente"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fornecedor (Compra)</label>
              <SeletorEntidade
                valor={fornecedor}
                onChange={setFornecedor}
                tipo="fornecedor"
                placeholder="Nome do Fornecedor"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Coluna Venda (O que está saindo) */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-pink-100 pb-2">
                <h3 className="text-sm font-bold text-pink-700 flex items-center gap-2 uppercase tracking-tighter">
                  📤 Itens Vendidos (Saída)
                </h3>
                <span className="text-xs font-mono bg-pink-50 text-pink-700 px-2 py-0.5 rounded border border-pink-100">
                  Total: R$ {totalVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="space-y-2">
                {itensVenda.map((item, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm relative group">
                    <SeletorProduto
                      onSelecionarProduto={(p: any) => {
                        const newItens = [...itensVenda]
                        newItens[idx] = {
                          ...newItens[idx],
                          id_produto: p.id,
                          nome: p.descricao,
                          preco_unitario: p.preco_venda || 0,
                          preco_custo: p.preco_custo || 0,
                          percentual_repasse: p.percentual_repasse || 0,
                          valor_repasse: p.valor_repasse || 0
                        }
                        setItensVenda(newItens)
                      }}
                    />
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <input
                        type="number"
                        placeholder="Qtd"
                        value={item.quantidade}
                        onChange={e => {
                          const newItens = [...itensVenda]
                          newItens[idx].quantidade = Number(e.target.value)
                          setItensVenda(newItens)
                        }}
                        className="border rounded px-2 py-1 text-xs"
                      />
                      <input
                        type="number"
                        placeholder="Preço"
                        value={item.preco_unitario}
                        onChange={e => {
                          const newItens = [...itensVenda]
                          newItens[idx].preco_unitario = Number(e.target.value)
                          setItensVenda(newItens)
                        }}
                        className="border rounded px-2 py-1 text-xs col-span-2"
                      />
                    </div>
                  </div>
                ))}
                <button onClick={adicionarItemVenda} className="w-full py-2 border-2 border-dashed border-pink-200 text-pink-600 rounded-lg text-xs hover:bg-pink-50 transition-colors flex items-center justify-center gap-1 font-bold uppercase">
                  <Plus size={14} /> Adicionar Produto
                </button>
              </div>
            </div>

            {/* Coluna Compra (O que está entrando - Troca) */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-blue-100 pb-2">
                <h3 className="text-sm font-bold text-blue-700 flex items-center gap-2 uppercase tracking-tighter">
                  📥 Itens Comprados/Troca (Entrada)
                </h3>
                <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                  Total: R$ {totalCompra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="space-y-2">
                {itensCompra.map((item, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm relative group">
                    <SeletorProduto
                      onSelecionarProduto={(p: any) => {
                        const newItens = [...itensCompra]
                        newItens[idx] = {
                          ...newItens[idx],
                          id_produto: p.id,
                          nome: p.descricao,
                          preco_unitario: p.preco_venda || 0,
                          preco_custo: p.preco_custo || 0,
                          percentual_repasse: p.percentual_repasse || 0,
                          valor_repasse: p.valor_repasse || 0
                        }
                        setItensCompra(newItens)
                      }}
                    />
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <input
                        type="number"
                        placeholder="Qtd"
                        value={item.quantidade}
                        onChange={e => {
                          const newItens = [...itensCompra]
                          newItens[idx].quantidade = Number(e.target.value)
                          setItensCompra(newItens)
                        }}
                        className="border rounded px-2 py-1 text-xs"
                      />
                      <input
                        type="number"
                        placeholder="Vlr Repasse"
                        value={item.valor_repasse}
                        onChange={e => {
                          const newItens = [...itensCompra]
                          newItens[idx].valor_repasse = Number(e.target.value)
                          setItensCompra(newItens)
                        }}
                        className="border rounded px-2 py-1 text-xs col-span-2"
                      />
                    </div>
                  </div>
                ))}
                <button onClick={adicionarItemCompra} className="w-full py-2 border-2 border-dashed border-blue-200 text-blue-600 rounded-lg text-xs hover:bg-blue-50 transition-colors flex items-center justify-center gap-1 font-bold uppercase">
                  <Plus size={14} /> Adicionar Produto
                </button>
              </div>
            </div>
          </div>

          {/* Dual Payment Forms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-200">
            {/* Pagamento Venda */}
            <div className="bg-pink-50/30 p-4 rounded-xl border border-pink-100 space-y-3">
              <h4 className="text-[10px] font-black text-pink-700 uppercase tracking-widest flex items-center gap-2">
                💳 Financeiro da Venda
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
                  <select
                    value={pagVenda.status}
                    onChange={e => setPagVenda({...pagVenda, status: e.target.value})}
                    className="w-full bg-white border border-pink-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-pink-500"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Parcelas</label>
                  <input
                    type="number"
                    value={pagVenda.parcelas}
                    onChange={e => setPagVenda({...pagVenda, parcelas: Number(e.target.value)})}
                    className="w-full bg-white border border-pink-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-pink-500"
                  />
                </div>
              </div>
            </div>

            {/* Pagamento Compra */}
            <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-100 space-y-3">
              <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-widest flex items-center gap-2">
                💳 Financeiro da Compra
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
                  <select
                    value={pagCompra.status}
                    onChange={e => setPagCompra({...pagCompra, status: e.target.value})}
                    className="w-full bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago (Troca)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Parcelas</label>
                  <input
                    type="number"
                    value={pagCompra.parcelas}
                    onChange={e => setPagCompra({...pagCompra, parcelas: Number(e.target.value)})}
                    className="w-full bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Resumo e Botão Final */}
          <div className="bg-slate-800 p-6 rounded-xl text-white flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400">Total Venda</p>
                <p className="text-xl font-mono">R$ {totalVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400">Total Compra</p>
                <p className="text-xl font-mono">R$ {totalCompra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="text-center bg-white/10 px-4 py-1 rounded-lg">
                <p className="text-[10px] uppercase font-bold text-slate-300">Diferença a {diferenca >= 0 ? 'Receber' : 'Pagar'}</p>
                <p className={`text-xl font-mono font-bold ${diferenca >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  R$ {Math.abs(diferenca).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !cliente || (itensVenda.length === 0 && itensCompra.length === 0)}
              className="bg-green-500 hover:bg-green-600 disabled:bg-slate-600 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 uppercase tracking-widest text-sm"
            >
              {loading ? 'Processando...' : 'Gerar Venda Casada'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
