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
  const [pagVenda, setPagVenda] = useState({ status: 'pendente', parcelas: 1, vencimento: data, prazo: 'mensal' })
  const [pagCompra, setPagCompra] = useState({ status: 'pago', parcelas: 1, vencimento: data, prazo: 'mensal' })

  // Efeito para carregar rascunho
  useEffect(() => {
    if (aberto) {
      const draft = getDraft('venda_casada')
      if (draft) {
        setCliente(draft.cliente || '')
        setFornecedor(draft.fornecedor || '')
        setData(draft.data || getDataAtualBrasil())
        setItens(draft.itens || [{ id: Date.now().toString(), id_produto: '', nome: '', quantidade: 1, preco_unitario: 0, valor_repasse: 0, preco_custo: 0 }])
        setPagVenda(draft.pagVenda || { status: 'pendente', parcelas: 1, vencimento: draft.data || getDataAtualBrasil(), prazo: 'mensal' })
        setPagCompra(draft.pagCompra || { status: 'pago', parcelas: 1, vencimento: draft.data || getDataAtualBrasil(), prazo: 'mensal' })
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

  const criarFinanceiro = async (total: number, entidade: string, tipo: 'entrada' | 'saida', refNum: number, status: string, qtdParcelas: number, vencimento: string, prazo: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const valorParcela = total / qtdParcelas
    const transacoes = []
    for (let i = 1; i <= qtdParcelas; i++) {
      let dataParcela = vencimento
      if (i > 1) {
        const dt = new Date(vencimento + 'T12:00:00')
        if (prazo === 'diaria') dt.setDate(dt.getDate() + (i - 1))
        else if (prazo === 'semanal') dt.setDate(dt.getDate() + (i - 1) * 7)
        else if (prazo === 'mensal') dt.setMonth(dt.getMonth() + (i - 1))
        dataParcela = dt.toISOString().split('T')[0]
      }
      const numTrans = parseInt(`${Date.now().toString().slice(-6)}${i}${Math.floor(Math.random() * 10)}`)
      transacoes.push({
        user_id: user.id,
        numero_transacao: numTrans,
        descricao: `${tipo === 'entrada' ? 'Venda' : 'Compra'} Casada - ${entidade} (${i}/${qtdParcelas})`,
        total: valorParcela,
        tipo,
        data: prepararDataParaInsert(dataParcela),
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
      await criarFinanceiro(totalVenda, cliente, 'entrada', numVenda, pagVenda.status, pagVenda.parcelas, pagVenda.vencimento, pagVenda.prazo)
      await criarFinanceiro(totalCompra, fornecedor, 'saida', numCompra, pagCompra.status, pagCompra.parcelas, pagCompra.vencimento, pagCompra.prazo)

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center z-[50] p-2 sm:p-4 overflow-y-auto pt-4 pb-20">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl flex flex-col h-fit my-auto">
        {/* Header - Mais compacto */}
        <div className="bg-slate-800 text-white px-4 py-2 flex justify-between items-center rounded-t-xl">
          <h2 className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest">
            <ShoppingBag className="text-pink-400" size={18} />
            Venda Casada
          </h2>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-3 space-y-3">
          {/* Dados Gerais - Ultra Compacto */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="flex flex-col">
              <label className="text-[10px] font-black text-pink-600 uppercase mb-0.5 ml-1 flex items-center gap-1">
                <ShoppingBag size={10} /> Cliente
              </label>
              <SeletorEntidade
                valor={cliente}
                onChange={setCliente}
                tipo="cliente"
                placeholder="Nome do cliente..."
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-black text-blue-600 uppercase mb-0.5 ml-1 flex items-center gap-1">
                <Truck size={10} /> Fornecedor
              </label>
              <SeletorEntidade
                valor={fornecedor}
                onChange={setFornecedor}
                tipo="fornecedor"
                placeholder="Nome do fornecedor..."
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-black text-slate-500 uppercase mb-0.5 ml-1">Data</label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none h-[30px]"
              />
            </div>
          </div>

          {/* Lista Única de Itens - Sem scroll interno, expande modal */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-800 px-3 py-1.5 flex justify-between items-center">
              <h3 className="text-[10px] font-bold text-white uppercase tracking-widest">Produtos Vinculados</h3>
              <button onClick={adicionarItem} className="bg-green-600 text-white px-2 py-1 rounded text-[9px] font-black hover:bg-green-700 transition-colors uppercase">
                + Item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-1.5 text-[10px] font-black text-slate-500 uppercase w-[40%]">Produto</th>
                    <th className="px-2 py-1.5 text-[10px] font-black text-slate-500 uppercase text-center w-[10%]">Qtd</th>
                    <th className="px-2 py-1.5 text-[10px] font-black text-pink-600 uppercase text-right w-[20%]">Preço Venda</th>
                    <th className="px-2 py-1.5 text-[10px] font-black text-blue-600 uppercase text-right w-[20%]">Vlr Repasse</th>
                    <th className="px-2 py-1.5 text-center w-[10%]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itens.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-1.5">
                        <SeletorProduto
                          onSelecionarProduto={(p) => selecionarProduto(p, item.id)}
                          placeholder="Buscar produto..."
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="number"
                          value={item.quantidade}
                          onChange={e => atualizarItem(item.id, 'quantidade', Number(e.target.value))}
                          className="w-16 border border-slate-300 rounded px-2 py-1 text-xs text-center focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="relative">
                          <span className="absolute left-2 top-1.5 text-[10px] text-pink-400 font-bold">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={item.preco_unitario}
                            onChange={e => atualizarItem(item.id, 'preco_unitario', Number(e.target.value))}
                            className="w-full border border-pink-200 bg-pink-50/10 rounded pl-7 pr-2 py-1 text-xs font-bold text-pink-700 focus:ring-1 focus:ring-pink-500 outline-none text-right"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="relative">
                          <span className="absolute left-2 top-1.5 text-[10px] text-blue-400 font-bold">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={item.valor_repasse}
                            onChange={e => atualizarItem(item.id, 'valor_repasse', Number(e.target.value))}
                            className="w-full border border-blue-200 bg-blue-50/10 rounded pl-7 pr-2 py-1 text-xs font-bold text-blue-700 focus:ring-1 focus:ring-blue-500 outline-none text-right"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => removerItem(item.id)} className="text-red-400 hover:text-red-600 transition-colors p-1">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financeiro e Pagamentos - Compacto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Pagamento Venda */}
            <div className="bg-pink-50/20 p-2 rounded-lg border border-pink-100 space-y-2">
              <div className="flex justify-between items-center border-b border-pink-100 pb-1">
                <h4 className="text-[10px] font-black text-pink-700 uppercase tracking-widest">💳 Venda</h4>
                <span className="text-xs font-black text-pink-700">R$ {totalVenda.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 tracking-tighter">Status</label>
                  <select
                    value={pagVenda.status}
                    onChange={e => setPagVenda({...pagVenda, status: e.target.value})}
                    className="w-full bg-white border border-pink-200 rounded px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-pink-500"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 tracking-tighter">Parcelas</label>
                  <input
                    type="number"
                    value={pagVenda.parcelas}
                    onChange={e => setPagVenda({...pagVenda, parcelas: Math.max(1, Number(e.target.value))})}
                    className="w-full bg-white border border-pink-200 rounded px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-pink-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 tracking-tighter">Vencimento</label>
                  <input
                    type="date"
                    value={pagVenda.vencimento}
                    onChange={e => setPagVenda({...pagVenda, vencimento: e.target.value})}
                    className="w-full bg-white border border-pink-200 rounded px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-pink-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 tracking-tighter">Prazo</label>
                  <select
                    value={pagVenda.prazo}
                    onChange={e => setPagVenda({...pagVenda, prazo: e.target.value})}
                    className="w-full bg-white border border-pink-200 rounded px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-pink-500"
                  >
                    <option value="mensal">Mensal</option>
                    <option value="semanal">Semanal</option>
                    <option value="diaria">Diária</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Pagamento Compra */}
            <div className="bg-blue-50/20 p-2 rounded-lg border border-blue-100 space-y-2">
              <div className="flex justify-between items-center border-b border-blue-100 pb-1">
                <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-widest">🚚 Compra</h4>
                <span className="text-xs font-black text-blue-700">R$ {totalCompra.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 tracking-tighter">Status</label>
                  <select
                    value={pagCompra.status}
                    onChange={e => setPagCompra({...pagCompra, status: e.target.value})}
                    className="w-full bg-white border border-blue-200 rounded px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 tracking-tighter">Parcelas</label>
                  <input
                    type="number"
                    value={pagCompra.parcelas}
                    onChange={e => setPagCompra({...pagCompra, parcelas: Math.max(1, Number(e.target.value))})}
                    className="w-full bg-white border border-blue-200 rounded px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 tracking-tighter">Vencimento</label>
                  <input
                    type="date"
                    value={pagCompra.vencimento}
                    onChange={e => setPagCompra({...pagCompra, vencimento: e.target.value})}
                    className="w-full bg-white border border-blue-200 rounded px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 tracking-tighter">Prazo</label>
                  <select
                    value={pagCompra.prazo}
                    onChange={e => setPagCompra({...pagCompra, prazo: e.target.value})}
                    className="w-full bg-white border border-blue-200 rounded px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="mensal">Mensal</option>
                    <option value="semanal">Semanal</option>
                    <option value="diaria">Diária</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Resumo Final - Ultra Otimizado */}
          <div className="bg-slate-900 p-3 rounded-lg text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-2 border-t border-pink-500">
            <div className="flex gap-4 items-center">
              <div className="text-center md:text-left">
                <p className="text-[8px] uppercase font-bold text-pink-400">Total Venda</p>
                <p className="text-sm font-black font-mono">R$ {totalVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="h-6 w-[1px] bg-white/10 hidden md:block"></div>
              <div className="text-center md:text-left">
                <p className="text-[8px] uppercase font-bold text-blue-400">Total Compra</p>
                <p className="text-sm font-black font-mono">R$ {totalCompra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="h-6 w-[1px] bg-white/10 hidden md:block"></div>
              <div className="text-center md:text-left">
                <p className="text-[8px] uppercase font-bold text-green-400">Diferença</p>
                <p className={`text-sm font-black font-mono ${diferenca >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  R$ {Math.abs(diferenca).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !cliente || !fornecedor || !itens.some(i => i.id_produto)}
              className="bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white px-8 py-2 rounded-lg font-black transition-all shadow-lg active:scale-95 uppercase tracking-tighter text-[11px]"
            >
              {loading ? 'Salvando...' : 'Finalizar Venda Casada'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
