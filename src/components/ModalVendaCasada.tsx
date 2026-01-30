'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, X, ShoppingBag, Truck } from 'lucide-react'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'
import { useFormDraft } from '@/context/FormDraftContext'
import SeletorProduto from './SeletorProduto'
import SeletorEntidade from './SeletorEntidade'
import { getDataAtualBrasil, prepararDataParaInsert } from '@/lib/dateUtils'

interface ItemVendaCasada {
  id: string
  id_produto: string
  nome: string
  quantidade: number
  preco_unitario: number // Preço de Venda
  valor_repasse: number   // Preço de Custo/Repasse (Compra)
  preco_custo: number     // Custo original do produto
}

interface ModalVendaCasadaProps {
  aberto: boolean
  onClose: () => void
  onSucesso: () => void
}

export default function ModalVendaCasada({ aberto, onClose, onSucesso }: ModalVendaCasadaProps) {
  const { recarregarDados } = useDadosFinanceiros()
  const { getDraft, setDraft, clearDraft } = useFormDraft()
  const [loading, setLoading] = useState(false)

  // Cabeçalho
  const [cliente, setCliente] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [data, setData] = useState(getDataAtualBrasil())

  // Lista Única de Itens
  const [itens, setItens] = useState<ItemVendaCasada[]>([
    { id: Date.now().toString(), id_produto: '', nome: '', quantidade: 1, preco_unitario: 0, valor_repasse: 0, preco_custo: 0 }
  ])

  // Pagamentos
  const [pagVenda, setPagVenda] = useState({ status: 'pendente', parcelas: 1 })
  const [pagCompra, setPagCompra] = useState({ status: 'pago', parcelas: 1 })

  // Efeito para carregar rascunho
  useEffect(() => {
    if (aberto) {
      const draft = getDraft('venda_casada')
      if (draft) {
        setCliente(draft.cliente || '')
        setFornecedor(draft.fornecedor || '')
        setData(draft.data || getDataAtualBrasil())
        setItens(draft.itens || [{ id: Date.now().toString(), id_produto: '', nome: '', quantidade: 1, preco_unitario: 0, valor_repasse: 0, preco_custo: 0 }])
        setPagVenda(draft.pagVenda || { status: 'pendente', parcelas: 1 })
        setPagCompra(draft.pagCompra || { status: 'pago', parcelas: 1 })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  // Efeito para salvar rascunho
  useEffect(() => {
    if (aberto && (cliente || fornecedor || itens.some(i => i.id_produto))) {
      setDraft('venda_casada', { cliente, fornecedor, data, itens, pagVenda, pagCompra })
    }
  }, [aberto, cliente, fornecedor, data, itens, pagVenda, pagCompra, setDraft])

  if (!aberto) return null

  const adicionarItem = () => {
    setItens([...itens, { id: Date.now().toString(), id_produto: '', nome: '', quantidade: 1, preco_unitario: 0, valor_repasse: 0, preco_custo: 0 }])
  }

  const removerItem = (id: string) => {
    if (itens.length > 1) {
      setItens(itens.filter(i => i.id !== id))
    }
  }

  const atualizarItem = (id: string, campo: keyof ItemVendaCasada, valor: any) => {
    setItens(prev => prev.map(i => i.id === id ? { ...i, [campo]: valor } : i))
  }

  const selecionarProduto = (produto: any, id: string) => {
    setItens(prev => prev.map(i => i.id === id ? {
      ...i,
      id_produto: produto.id,
      nome: produto.descricao,
      preco_unitario: produto.preco_venda || 0,
      valor_repasse: produto.valor_repasse || 0,
      preco_custo: produto.preco_custo || 0
    } : i))
  }

  const totalVenda = itens.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario), 0)
  const totalCompra = itens.reduce((acc, item) => acc + (item.quantidade * item.valor_repasse), 0)
  const diferenca = totalVenda - totalCompra

  const criarFinanceiro = async (total: number, entidade: string, tipo: 'entrada' | 'saida', refNum: number, status: string, qtdParcelas: number) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const valorParcela = total / qtdParcelas
    const transacoes = []
    for (let i = 1; i <= qtdParcelas; i++) {
      const numTrans = parseInt(`${Date.now().toString().slice(-6)}${i}${Math.floor(Math.random() * 10)}`)
      transacoes.push({
        user_id: user.id,
        numero_transacao: numTrans,
        descricao: `${tipo === 'entrada' ? 'Venda' : 'Compra'} Casada - ${entidade} (${i}/${qtdParcelas})`,
        total: valorParcela,
        tipo,
        data: prepararDataParaInsert(data),
        status_pagamento: i === 1 && total > 0 ? status : 'pendente',
        observacao: `Ref. #${refNum}`
      })
    }
    await supabase.from('transacoes_loja').insert(transacoes)
  }

  const handleSubmit = async () => {
    if (!cliente || !fornecedor) return alert('Informe Cliente e Fornecedor')
    const itensValidos = itens.filter(i => i.id_produto)
    if (itensValidos.length === 0) return alert('Adicione pelo menos um item válido')

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
        observacao: `VENDA CASADA (Simultânea com Compra #${numVenda + 1})`
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
        observacao: `COMPRA CASADA (Simultânea com Venda #${numVenda})`
      }).select().single()
      if (errCompra) throw errCompra

      // 3. Processar Itens
      for (const item of itensValidos) {
        // Registro na Venda (Saída)
        await supabase.from('itens_venda').insert({
          venda_id: venda.id,
          produto_id: item.id_produto,
          descricao: item.nome,
          quantidade: item.quantidade,
          preco_venda: item.preco_unitario,
          preco_custo: item.preco_custo,
          valor_repasse: item.valor_repasse
        })

        // Registro na Compra (Entrada)
        await supabase.from('itens_compra').insert({
          compra_id: compra.id,
          produto_id: item.id_produto,
          descricao: item.nome,
          quantidade: item.quantidade,
          preco_custo: item.preco_custo,
          valor_repasse: item.valor_repasse,
          preco_venda: item.preco_unitario
        })

        // Movimentação de Estoque (Entrada e Saída se anulam se for o mesmo item,
        // mas é importante registrar ambos os fluxos para auditoria e histórico de custos)

        // Entrada (Compra)
        await supabase.rpc('atualizar_estoque', { produto_id_param: item.id_produto, quantidade_param: item.quantidade })
        await supabase.from('movimentacoes_estoque').insert({
          produto_id: item.id_produto, tipo: 'entrada', quantidade: item.quantidade, observacao: `Entrada Venda Casada #${numCompra}`
        })

        // Saída (Venda)
        await supabase.rpc('atualizar_estoque', { produto_id_param: item.id_produto, quantidade_param: -item.quantidade })
        await supabase.from('movimentacoes_estoque').insert({
          produto_id: item.id_produto, tipo: 'saida', quantidade: item.quantidade, observacao: `Saída Venda Casada #${numVenda}`
        })
      }

      // 4. Gerar Financeiro
      await criarFinanceiro(totalVenda, cliente, 'entrada', numVenda, pagVenda.status, pagVenda.parcelas)
      await criarFinanceiro(totalCompra, fornecedor, 'saida', numCompra, pagCompra.status, pagCompra.parcelas)

      alert('✅ Venda Casada gerada com sucesso!')
      clearDraft('venda_casada')
      recarregarDados()
      onSucesso()
      onClose()
    } catch (error: any) {
      alert('Erro: ' + error.message)
      console.error(error)
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
            <ShoppingBag className="text-pink-400" size={24} />
            <span className="text-white">Venda Casada</span>
          </h2>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors text-white">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Dados Gerais: Cliente e Fornecedor */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
              <label className="block text-[10px] font-black text-pink-600 uppercase mb-2 flex items-center gap-1">
                <ShoppingBag size={12} /> Cliente (Comprador)
              </label>
              <SeletorEntidade
                valor={cliente}
                onChange={setCliente}
                tipo="cliente"
                placeholder="Quem está comprando?"
              />
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
              <label className="block text-[10px] font-black text-blue-600 uppercase mb-2 flex items-center gap-1">
                <Truck size={12} /> Fornecedor (Vendedor)
              </label>
              <SeletorEntidade
                valor={fornecedor}
                onChange={setFornecedor}
                tipo="fornecedor"
                placeholder="De quem estamos comprando?"
              />
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Data da Operação</label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-slate-400 outline-none"
              />
            </div>
          </div>

          {/* Lista Única de Itens */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Produtos Vinculados</h3>
              <button onClick={adicionarItem} className="bg-slate-800 text-white px-3 py-1 rounded text-[10px] font-bold hover:bg-slate-700 transition-colors uppercase">
                + Adicionar Item
              </button>
            </div>

            <div className="p-4 space-y-3">
              {itens.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="md:col-span-5">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Produto</label>
                    <SeletorProduto
                      onSelecionarProduto={(p) => selecionarProduto(p, item.id)}
                      placeholder="Buscar produto para compra e venda..."
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Qtd</label>
                    <input
                      type="number"
                      value={item.quantidade}
                      onChange={e => atualizarItem(item.id, 'quantidade', Number(e.target.value))}
                      className="w-full border rounded px-2 py-1 text-xs"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[9px] font-bold text-pink-500 uppercase mb-1">Preço Venda</label>
                    <input
                      type="number"
                      value={item.preco_unitario}
                      onChange={e => atualizarItem(item.id, 'preco_unitario', Number(e.target.value))}
                      className="w-full border border-pink-100 bg-pink-50/30 rounded px-2 py-1 text-xs font-bold text-pink-700"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[9px] font-bold text-blue-500 uppercase mb-1">Vlr Repasse</label>
                    <input
                      type="number"
                      value={item.valor_repasse}
                      onChange={e => atualizarItem(item.id, 'valor_repasse', Number(e.target.value))}
                      className="w-full border border-blue-100 bg-blue-50/30 rounded px-2 py-1 text-xs font-bold text-blue-700"
                    />
                  </div>
                  <div className="md:col-span-1 text-right">
                    <button onClick={() => removerItem(item.id)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financeiro e Pagamentos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pagamento Venda */}
            <div className="bg-pink-50/30 p-4 rounded-xl border border-pink-100 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black text-pink-700 uppercase tracking-widest">💳 Financeiro da Venda</h4>
                <span className="text-sm font-black text-pink-700">R$ {totalVenda.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
                  <select
                    value={pagVenda.status}
                    onChange={e => setPagVenda({...pagVenda, status: e.target.value})}
                    className="w-full bg-white border border-pink-200 rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-pink-500"
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
                    onChange={e => setPagVenda({...pagVenda, parcelas: Math.max(1, Number(e.target.value))})}
                    className="w-full bg-white border border-pink-200 rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-pink-500"
                  />
                </div>
              </div>
            </div>

            {/* Pagamento Compra */}
            <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-100 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-widest">🚚 Financeiro da Compra</h4>
                <span className="text-sm font-black text-blue-700">R$ {totalCompra.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
                  <select
                    value={pagCompra.status}
                    onChange={e => setPagCompra({...pagCompra, status: e.target.value})}
                    className="w-full bg-white border border-blue-200 rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Parcelas</label>
                  <input
                    type="number"
                    value={pagCompra.parcelas}
                    onChange={e => setPagCompra({...pagCompra, parcelas: Math.max(1, Number(e.target.value))})}
                    className="w-full bg-white border border-blue-200 rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Resumo Final */}
          <div className="bg-slate-900 p-6 rounded-xl text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 border-t-4 border-pink-500">
            <div className="flex flex-wrap gap-8 justify-center md:justify-start">
              <div className="text-center md:text-left">
                <p className="text-[10px] uppercase font-black text-pink-400 tracking-tighter">Total a Receber</p>
                <p className="text-2xl font-black font-mono">R$ {totalVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="text-center md:text-left border-x border-white/10 px-8">
                <p className="text-[10px] uppercase font-black text-blue-400 tracking-tighter">Total a Pagar</p>
                <p className="text-2xl font-black font-mono">R$ {totalCompra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-[10px] uppercase font-black text-green-400 tracking-tighter">Saldo da Operação</p>
                <p className={`text-2xl font-black font-mono ${diferenca >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  R$ {Math.abs(diferenca).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !cliente || !fornecedor || !itens.some(i => i.id_produto)}
              className="bg-green-500 hover:bg-green-600 disabled:bg-slate-700 text-white px-10 py-4 rounded-xl font-black transition-all shadow-lg active:scale-95 uppercase tracking-widest text-sm border-b-4 border-green-700 disabled:border-slate-800"
            >
              {loading ? 'Processando...' : 'Finalizar Venda Casada'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
