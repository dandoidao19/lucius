'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Trash2, X, ShoppingBag, Truck, Handshake } from 'lucide-react'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'
import { useFormDraft } from '@/context/FormDraftContext'
import SeletorProduto from './SeletorProduto'
import SeletorEntidade from './SeletorEntidade'
import { getDataAtualBrasil, prepararDataParaInsert } from '@/lib/dateUtils'

interface ItemVendaCasada {
  id: string
  id_produto: string
  codigo: string
  nome: string
  quantidade: number
  preco_unitario: number
  valor_repasse: number
  preco_custo: number
  categoria?: string
  isNovoCadastro?: boolean
  minimizado?: boolean
}

interface ModalVendaCasadaProps {
  aberto: boolean
  onClose: () => void
  onSucesso: () => void
}

export default function ModalVendaCasada({ aberto, onClose, onSucesso }: ModalVendaCasadaProps) {
  const { triggerRefresh } = useDadosFinanceiros()
  const { getDraft, setDraft, clearDraft } = useFormDraft()
  const [loading, setLoading] = useState(false)
  const [categorias, setCategorias] = useState<{ id: string; nome: string; percentual_repasse?: number }[]>([])
  const [resetSeletorKey, setResetSeletorKey] = useState(Date.now())

  const [cliente, setCliente] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [data, setData] = useState(getDataAtualBrasil())
  const [tipoSaida, setTipoSaida] = useState<'venda' | 'pedido_venda'>('venda')
  const [tipoEntrada, setTipoEntrada] = useState<'compra' | 'pedido_compra'>('compra')

  const [pedidosSaidaAbertos, setPedidosSaidaAbertos] = useState<any[]>([])
  const [pedidosEntradaAbertos, setPedidosEntradaAbertos] = useState<any[]>([])
  const [mostrarBuscaSaida, setMostrarBuscaSaida] = useState(false)
  const [mostrarBuscaEntrada, setMostrarBuscaEntrada] = useState(false)
  const [idSaidaAnexar, setIdSaidaAnexar] = useState<string | null>(null)
  const [idEntradaAnexar, setIdEntradaAnexar] = useState<string | null>(null)
  const [idSaidaAnexarIsNovo, setIdSaidaAnexarIsNovo] = useState(false)
  const [idEntradaAnexarIsNovo, setIdEntradaAnexarIsNovo] = useState(false)
  const [totalSaidaAnterior, setTotalSaidaAnterior] = useState(0)
  const [totalEntradaAnterior, setTotalEntradaAnterior] = useState(0)

  const [itens, setItens] = useState<ItemVendaCasada[]>([
    { id: Date.now().toString(), id_produto: '', codigo: '', nome: '', quantidade: 1, preco_unitario: 0, valor_repasse: 0, preco_custo: 0, isNovoCadastro: false, minimizado: false }
  ])

  const [pagVenda, setPagVenda] = useState({ status: 'pendente', parcelas: 1, vencimento: data, prazo: 'mensal' })
  const [pagCompra, setPagCompra] = useState({ status: 'pendente', parcelas: 1, vencimento: data, prazo: 'mensal' })

  const [casadasAbertas, setCasadasAbertas] = useState<any[]>([])
  const [mostrarBuscaCasada, setMostrarBuscaCasada] = useState(false)
  const [vendaAnexar, setVendaAnexar] = useState<any>(null)
  const [compraAnexar, setCompraAnexar] = useState<any>(null)

  useEffect(() => {
    if (aberto) {
      const fetchCategorias = async () => {
        const { data } = await supabase.from('categorias_estoque').select('*').order('nome')
        setCategorias(data || [])
      }
      fetchCategorias()

      const draft = getDraft('venda_casada')
      if (draft) {
        setCliente(draft.cliente || '')
        setFornecedor(draft.fornecedor || '')
        setData(draft.data || getDataAtualBrasil())
        setItens(draft.itens || [{ id: Date.now().toString(), id_produto: '', codigo: '', nome: '', quantidade: 1, preco_unitario: 0, valor_repasse: 0, preco_custo: 0 }])
        setPagVenda(draft.pagVenda || { status: 'pendente', parcelas: 1, vencimento: draft.data || getDataAtualBrasil(), prazo: 'mensal' })
        setPagCompra(draft.pagCompra || { status: 'pendente', parcelas: 1, vencimento: draft.data || getDataAtualBrasil(), prazo: 'mensal' })
      }
    }
  }, [aberto])

  useEffect(() => {
    if (aberto && (cliente || fornecedor || itens.some(i => i.id_produto))) {
      setDraft('venda_casada', { cliente, fornecedor, data, itens, pagVenda, pagCompra })
    }
  }, [aberto, cliente, fornecedor, data, itens, pagVenda, pagCompra, setDraft])

  const resetForm = () => {
    setCliente(''); setFornecedor(''); setData(getDataAtualBrasil())
    setItens([{ id: Date.now().toString(), id_produto: '', codigo: '', nome: '', quantidade: 1, preco_unitario: 0, valor_repasse: 0, preco_custo: 0, isNovoCadastro: false, minimizado: false }])
    setPagVenda({ status: 'pendente', parcelas: 1, vencimento: getDataAtualBrasil(), prazo: 'mensal' })
    setPagCompra({ status: 'pendente', parcelas: 1, vencimento: getDataAtualBrasil(), prazo: 'mensal' })
    setVendaAnexar(null); setCompraAnexar(null); setIdSaidaAnexar(null); setIdEntradaAnexar(null)
    setIdSaidaAnexarIsNovo(false); setIdEntradaAnexarIsNovo(false); setTotalSaidaAnterior(0); setTotalEntradaAnterior(0)
  }

  const adicionarItem = () => {
    setItens(prev => [...prev.map(i => ({ ...i, minimizado: true })), { id: Date.now().toString(), id_produto: '', codigo: '', nome: '', quantidade: 1, preco_unitario: 0, valor_repasse: 0, preco_custo: 0, isNovoCadastro: false, minimizado: false }])
  }

  const atualizarItem = (id: string, campo: keyof ItemVendaCasada, valor: any) => {
    setItens(prev => prev.map(i => i.id === id ? { ...i, [campo]: valor } : i))
  }

  const selecionarProduto = (produto: any, id: string) => {
    setItens(prev => prev.map(i => i.id === id ? {
      ...i, id_produto: produto.id, codigo: produto.codigo || '', nome: produto.descricao,
      preco_unitario: produto.preco_venda || 0, valor_repasse: produto.valor_repasse || 0, preco_custo: produto.preco_custo || 0
    } : i))
  }

  const criarFinanceiro = async (total: number, entidade: string, tipo: 'entrada' | 'saida', refNum: number, status: string, qtdParcelas: number, vencimento: string, prazo: string, parentIds: any, isPedido: boolean = false) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const valorBase = Math.floor((total / qtdParcelas) * 100) / 100
    const valorUltima = Number((total - (valorBase * (qtdParcelas - 1))).toFixed(2))
    const transacoes = []
    for (let i = 1; i <= qtdParcelas; i++) {
      let dtP = vencimento
      if (i > 1) {
        const dt = new Date(vencimento + 'T12:00:00')
        if (prazo === 'diaria') dt.setDate(dt.getDate() + (i - 1))
        else if (prazo === 'semanal') dt.setDate(dt.getDate() + (i - 1) * 7)
        else if (prazo === 'mensal') dt.setMonth(dt.getMonth() + (i - 1))
        dtP = dt.toISOString().split('T')[0]
      }
      transacoes.push({
        user_id: user.id, numero_transacao: refNum, descricao: `${tipo === 'entrada' ? 'Venda' : 'Compra'} ${entidade} (${i}/${qtdParcelas})`,
        total: i === qtdParcelas ? valorUltima : valorBase, tipo, data: prepararDataParaInsert(dtP),
        status_pagamento: i === 1 && total > 0 ? status : 'pendente', observacao: isPedido ? `[PEDIDO] Ref. #${refNum}` : `Ref. #${refNum}`,
        quantidade_parcelas: qtdParcelas, ...parentIds
      })
    }
    const { error } = await supabase.from('transacoes_loja').insert(transacoes)
    if (error) throw error
  }

  const totalVenda = itens.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario), 0)
  const totalCompra = itens.reduce((acc, item) => acc + (item.quantidade * item.valor_repasse), 0)
  const diferenca = totalVenda - totalCompra

  const handleSubmit = async () => {
    if (!cliente || !fornecedor) return alert('Informe Cliente e Fornecedor')
    const itensValidos = itens.filter(i => i.id_produto || (i.isNovoCadastro && i.nome))
    if (itensValidos.length === 0) return alert('Adicione pelo menos um item válido')
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')
      const { data: n1 } = await supabase.rpc('obter_proximo_numero_transacao')
      const { data: n2 } = await supabase.rpc('obter_proximo_numero_transacao')
      let numS = n1, numE = n2
      if (vendaAnexar) { numS = vendaAnexar.numero_transacao; numE = compraAnexar?.numero_transacao || numS }

      let idS = null, idE = null
      const obsS = `VENDA CASADA (Simultânea com Transação #${numE})`
      const obsE = `VENDA CASADA (Simultânea com Transação #${numS})`

      if (tipoSaida === 'venda') {
        if (vendaAnexar) {
          idS = vendaAnexar.id
          await supabase.from('vendas').update({ total: (vendaAnexar.total || 0) + totalVenda, quantidade_itens: (vendaAnexar.quantidade_itens || 0) + itensValidos.length }).eq('id', idS)
          await supabase.from('transacoes_loja').delete().eq('id_venda', idS); await criarFinanceiro((vendaAnexar.total || 0) + totalVenda, cliente, 'entrada', numS, pagVenda.status, pagVenda.parcelas, pagVenda.vencimento, pagVenda.prazo, { id_venda: idS })
        } else {
          const { data: v } = await supabase.from('vendas').insert({ cliente, data_venda: prepararDataParaInsert(data), total: totalVenda, status_pagamento: pagVenda.status, user_id: user.id, numero_transacao: numS, observacao: obsS, quantidade_parcelas: pagVenda.parcelas, prazoparcelas: pagVenda.prazo, quantidade_itens: itensValidos.length }).select().single()
          idS = v.id; await criarFinanceiro(totalVenda, cliente, 'entrada', numS, pagVenda.status, pagVenda.parcelas, pagVenda.vencimento, pagVenda.prazo, { id_venda: idS })
        }
      } else {
        const { data: p } = await supabase.from('pedidos_loja').insert({ entidade: cliente, data_pedido: prepararDataParaInsert(data), tipo: 'venda', status: 'pendente', numero_transacao: numS, total_geral: totalVenda, total_financeiro: totalVenda, observacao: obsS, user_id: user.id, quantidade_parcelas: pagVenda.parcelas, prazoparcelas: pagVenda.prazo, data_vencimento: prepararDataParaInsert(pagVenda.vencimento) }).select().single()
        idS = p.id; await criarFinanceiro(totalVenda, cliente, 'entrada', numS, 'pendente', pagVenda.parcelas, pagVenda.vencimento, pagVenda.prazo, { id_pedido: idS }, true)
      }

      if (tipoEntrada === 'compra') {
        if (compraAnexar) {
          idE = compraAnexar.id
          await supabase.from('compras').update({ total: (compraAnexar.total || 0) + totalCompra, quantidade_itens: (compraAnexar.quantidade_itens || 0) + itensValidos.length }).eq('id', idE)
          await supabase.from('transacoes_loja').delete().eq('id_compra', idE); await criarFinanceiro((compraAnexar.total || 0) + totalCompra, fornecedor, 'saida', numE, pagCompra.status, pagCompra.parcelas, pagCompra.vencimento, pagCompra.prazo, { id_compra: idE })
        } else {
          const { data: c } = await supabase.from('compras').insert({ fornecedor, data_compra: prepararDataParaInsert(data), total: totalCompra, status_pagamento: pagCompra.status, user_id: user.id, numero_transacao: numE, observacao: obsE, quantidade_parcelas: pagCompra.parcelas, prazoparcelas: pagCompra.prazo, quantidade_itens: itensValidos.length }).select().single()
          idE = c.id; await criarFinanceiro(totalCompra, fornecedor, 'saida', numE, pagCompra.status, pagCompra.parcelas, pagCompra.vencimento, pagCompra.prazo, { id_compra: idE })
        }
      } else {
        const { data: p } = await supabase.from('pedidos_loja').insert({ entidade: fornecedor, data_pedido: prepararDataParaInsert(data), tipo: 'compra', status: 'pendente', numero_transacao: numE, total_geral: totalCompra, total_financeiro: totalCompra, observacao: obsE, user_id: user.id, quantidade_parcelas: pagCompra.parcelas, prazoparcelas: pagCompra.prazo, data_vencimento: prepararDataParaInsert(pagCompra.vencimento) }).select().single()
        idE = p.id; await criarFinanceiro(totalCompra, fornecedor, 'saida', numE, 'pendente', pagCompra.parcelas, pagCompra.vencimento, pagCompra.prazo, { id_pedido: idE }, true)
      }

      for (const it of itensValidos) {
        let pId = it.id_produto
        if (it.isNovoCadastro && !pId) {
          const { data: nP } = await supabase.from('produtos').insert({ descricao: it.nome.toUpperCase(), categoria: it.categoria, preco_custo: it.preco_custo, valor_repasse: it.valor_repasse, preco_venda: it.preco_unitario, quantidade: 0, user_id: user.id }).select().single()
          pId = nP.id
        }
        const common = { produto_id: pId, descricao: it.nome, quantidade: it.quantidade, preco_venda: it.preco_unitario, preco_custo: it.preco_custo, valor_repasse: it.valor_repasse }
        if (tipoSaida === 'venda') await supabase.from('itens_venda').insert({ venda_id: idS, ...common, observacao: `Transação #${numE}` })
        else await supabase.from('itens_pedido_loja').insert({ pedido_id: idS, ...common, status: 'pendente', observacao_item: `Transação #${numE}` })
        if (tipoEntrada === 'compra') await supabase.from('itens_compra').insert({ compra_id: idE, ...common, observacao: `Transação #${numS}` })
        else await supabase.from('itens_pedido_loja').insert({ pedido_id: idE, ...common, status: 'pendente', observacao_item: `Transação #${numS}` })
        if (pId) {
          if (tipoSaida !== 'pedido_venda') { await supabase.rpc('atualizar_estoque', { produto_id_param: pId, quantidade_param: -it.quantidade }); await supabase.from('movimentacoes_estoque').insert({ produto_id: pId, tipo: 'saida', quantidade: it.quantidade, observacao: `Transação #${numS}` }) }
          if (tipoEntrada !== 'pedido_compra') { await supabase.rpc('atualizar_estoque', { produto_id_param: pId, quantidade_param: it.quantidade }); await supabase.from('produtos').update({ preco_custo: it.preco_custo, valor_repasse: it.valor_repasse, preco_venda: it.preco_unitario, data_ultima_compra: prepararDataParaInsert(data) }).eq('id', pId); await supabase.from('movimentacoes_estoque').insert({ produto_id: pId, tipo: 'entrada', quantidade: it.quantidade, observacao: `Transação #${numE}` }) }
        }
      }
      triggerRefresh(); onSucesso(); alert('✅ Sucesso!'); clearDraft('venda_casada'); resetForm(); onClose()
    } catch (e: any) { alert('Erro: ' + e.message) } finally { setLoading(false) }
  }

  if (!aberto) return null
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center z-[50] p-2 overflow-y-auto pt-4 pb-20">
      <div className="bg-white w-full max-w-6xl rounded-xl shadow-xl flex flex-col h-fit my-auto min-h-[600px]">
        <div className="bg-slate-900 text-white px-4 py-2 flex justify-between items-center rounded-t-xl sticky top-0 z-20">
          <h2 className="text-sm font-semibold flex items-center gap-2 uppercase tracking-widest"><ShoppingBag className="text-pink-400" size={18} /> Venda Casada</h2>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded text-white"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex justify-between items-center p-2 rounded border bg-slate-50 border-slate-200">
             <span className="text-xs font-bold text-slate-800 uppercase">LANÇAMENTO ÚNICO</span>
             {(vendaAnexar || idSaidaAnexar || idEntradaAnexar) && <button onClick={resetForm} className="text-[10px] font-bold text-red-600 hover:underline">CANCELAR ANEXO</button>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col"><label className="text-[11px] font-semibold text-pink-600 uppercase mb-0.5 ml-1 flex items-center gap-1"><ShoppingBag size={10} /> Cliente</label><SeletorEntidade valor={cliente} onChange={setCliente} tipo="cliente" placeholder="Nome..." disabled={!!vendaAnexar || !!idSaidaAnexar} /></div>
            <div className="flex flex-col"><label className="text-[11px] font-semibold text-blue-600 uppercase mb-0.5 ml-1 flex items-center gap-1"><Truck size={10} /> Fornecedor</label><SeletorEntidade valor={fornecedor} onChange={setFornecedor} tipo="fornecedor" placeholder="Nome..." disabled={!!compraAnexar || !!idEntradaAnexar} /></div>
            <div className="flex flex-col"><label className="text-[11px] font-semibold text-slate-500 uppercase mb-0.5 ml-1">Data</label><input type="date" value={data} onChange={e => setData(e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1 text-xs h-[32px] outline-none focus:ring-1 focus:ring-pink-500" disabled={!!vendaAnexar || !!idSaidaAnexar} /></div>
          </div>
          <div className="border rounded-lg bg-white overflow-visible">
            <div className="bg-slate-50 px-3 py-1.5 flex justify-between items-center border-b"><h3 className="text-[11px] font-semibold uppercase">Produtos</h3><button onClick={adicionarItem} className="bg-slate-900 text-white px-3 py-1 rounded text-[10px] uppercase">+ ITEM</button></div>
            <div className="p-2 space-y-2">
              {itens.map((it, idx) => (
                <div key={it.id} className="border rounded p-2 bg-slate-50">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center"><span className="text-[11px] font-black uppercase">Item {idx+1}</span><label className="flex items-center gap-1.5 cursor-pointer bg-white px-2 py-0.5 rounded border text-[10px] font-bold uppercase"><input type="checkbox" checked={it.isNovoCadastro} onChange={() => atualizarItem(it.id, 'isNovoCadastro', !it.isNovoCadastro)} className="w-3.5 h-3.5 accent-pink-600" /> Novo Cadastro</label></div>
                    {!it.isNovoCadastro ? <SeletorProduto onSelecionarProduto={p => selecionarProduto(p, it.id)} placeholder="Buscar..." descricaoPreenchida={it.nome} /> :
                    <div className="grid grid-cols-3 gap-2"><input type="text" placeholder="Código" value={it.codigo} onChange={e => atualizarItem(it.id, 'codigo', e.target.value)} className="col-span-1 px-2 py-1 text-xs border rounded" /><input type="text" placeholder="Descrição" value={it.nome} onChange={e => atualizarItem(it.id, 'nome', e.target.value)} className="col-span-2 px-2 py-1 text-xs border rounded" /></div>}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col"><label className="text-[9px] uppercase font-bold text-red-600">Custo</label><input type="number" value={it.preco_custo} onChange={e => atualizarItem(it.id, 'preco_custo', Number(e.target.value))} className="px-2 py-1 text-xs border rounded" /></div>
                      <div className="flex flex-col"><label className="text-[9px] uppercase font-bold text-orange-600">Qtd</label><input type="number" value={it.quantidade} onChange={e => atualizarItem(it.id, 'quantidade', Number(e.target.value))} className="px-2 py-1 text-xs border rounded" /></div>
                      <div className="flex flex-col"><label className="text-[9px] uppercase font-bold text-green-600">Venda</label><input type="number" value={it.preco_unitario} onChange={e => atualizarItem(it.id, 'preco_unitario', Number(e.target.value))} className="px-2 py-1 text-xs border rounded" /></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-900 p-3 rounded-lg text-white flex flex-col md:flex-row justify-between items-center gap-4 border-t border-pink-500">
            <div className="flex gap-6">
              <div className="flex flex-col">
                <p className="text-[8px] uppercase font-semibold text-pink-400">Venda { (totalSaidaAnterior > 0) ? '(Anterior + Novo)' : '' }</p>
                <div className="flex items-center gap-2">
                  {totalSaidaAnterior > 0 && <span className="text-[10px] text-slate-400 font-mono">R$ {totalSaidaAnterior.toFixed(2)} + </span>}
                  <p className="text-sm font-black font-mono">R$ {(totalSaidaAnterior + totalVenda).toFixed(2)}</p>
                </div>
              </div>
              <div className="flex flex-col border-l border-white/10 pl-6">
                <p className="text-[8px] uppercase font-semibold text-blue-400">Compra { (totalEntradaAnterior > 0) ? '(Anterior + Novo)' : '' }</p>
                <div className="flex items-center gap-2">
                  {totalEntradaAnterior > 0 && <span className="text-[10px] text-slate-400 font-mono">R$ {totalEntradaAnterior.toFixed(2)} + </span>}
                  <p className="text-sm font-black font-mono">R$ {(totalEntradaAnterior + totalCompra).toFixed(2)}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => onClose()} className="bg-slate-700 hover:bg-red-700 text-white px-8 py-2 rounded font-bold uppercase text-[10px]">Cancelar</button>
              <button onClick={handleSubmit} disabled={loading} className="bg-green-600 hover:bg-green-500 text-white px-10 py-2 rounded font-black uppercase text-[10px]">{loading ? '...' : '💰 Finalizar'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
