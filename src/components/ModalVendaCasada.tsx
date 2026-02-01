'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Trash2, X, ShoppingBag, Truck } from 'lucide-react'
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
  useEffect(() => {
    if (aberto) console.log('🚀 LUCIUS V3.6 - MODAL VENDA CASADA CARREGADO')
  }, [aberto])

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

  const [casadasAbertas, setCasadasAbertas] = useState<any[]>([])
  const [mostrarBuscaCasada, setMostrarBuscaCasada] = useState(false)
  const [vendaAnexar, setVendaAnexar] = useState<any>(null)
  const [compraAnexar, setCompraAnexar] = useState<any>(null)

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

  const formatarErro = (err: any): string => {
    if (!err) return 'Erro desconhecido'
    if (typeof err === 'string') return err

    if (err.code === 'PGRST204') {
      return 'ERRO CRÍTICO DE BANCO DE DADOS: Colunas necessárias não encontradas. POR FAVOR, EXECUTE O SCRIPT SQL V3.5 NO SEU SUPABASE (SQL EDITOR).'
    }

    let mensagem = err.message || 'Erro interno'
    if (err.details) mensagem += ` (Detalhes: ${err.details})`
    if (err.code) mensagem += ` [Código: ${err.code}]`
    if (err.hint) mensagem += ` - Dica: ${err.hint}`

    if (mensagem === 'Erro interno' && typeof err === 'object') {
      try {
        const str = JSON.stringify(err)
        return str !== '{}' ? str : 'Erro não catalogado (Objeto vazio)'
      } catch {
        return 'Erro ao processar objeto de erro'
      }
    }
    return mensagem
  }

  if (!aberto) return null

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

  const buscarCasadas = async () => {
    try {
      const { data: vendas, error } = await supabase
        .from('vendas')
        .select('*')
        .ilike('observacao', '%VENDA CASADA%')
        .order('data_venda', { ascending: false })
        .limit(10)

      if (error) throw error
      setCasadasAbertas(vendas || [])
      setMostrarBuscaCasada(true)
    } catch (err) {
      console.error('Erro ao buscar vendas casadas:', err)
    }
  }

  const selecionarCasadaParaAnexar = async (venda: any) => {
    if (!window.confirm(`Deseja ADICIONAR itens à Venda Casada #${venda.numero_transacao}?`)) return

    try {
      // Tentar encontrar a compra vinculada via observação
      // A observação padrão é: "VENDA CASADA (Simultânea com Compra #123)"
      const match = venda.observacao.match(/Compra #(\d+)/)
      let compraEncontrada = null

      if (match && match[1]) {
        const numCompra = parseInt(match[1])
        const { data: c } = await supabase.from('compras').select('*').eq('numero_transacao', numCompra).single()
        compraEncontrada = c
      }

      setVendaAnexar(venda)
      setCompraAnexar(compraEncontrada)
      setCliente(venda.cliente)
      if (compraEncontrada) setFornecedor(compraEncontrada.fornecedor)
      setData(venda.data_venda.split('T')[0])
      setMostrarBuscaCasada(false)
    } catch (err) {
      console.error('Erro ao vincular compra casada:', err)
      alert('Erro ao encontrar compra vinculada.')
    }
  }

  const handleSubmit = async () => {
    if (!cliente || !fornecedor) return alert('Informe Cliente e Fornecedor')
    const itensValidos = itens.filter(i => i.id_produto)
    if (itensValidos.length === 0) return alert('Adicione pelo menos um item válido')

    setLoading(true)
    try {
      console.log('DEBUG: Iniciando processamento de Venda Casada:', { cliente, fornecedor, totalVenda, totalCompra, itensCount: itensValidos.length })
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      let venda = vendaAnexar
      let compra = compraAnexar
      let numVenda = vendaAnexar?.numero_transacao
      let numCompra = compraAnexar?.numero_transacao

      if (!vendaAnexar) {
        // 1. Gerar Venda
        const { data: nV, error: errNumV } = await supabase.rpc('obter_proximo_numero_transacao')
        if (errNumV) throw errNumV
        numVenda = nV

        const { data: v, error: errVenda } = await supabase.from('vendas').insert({
          cliente,
          data_venda: prepararDataParaInsert(data),
          total: totalVenda,
          status_pagamento: pagVenda.status,
          user_id: user.id,
          numero_transacao: numVenda,
          observacao: `VENDA CASADA (Simultânea com Compra #${numVenda + 1})`
        }).select().single()
        if (errVenda) throw errVenda
        venda = v
      } else {
        // Atualizar total da venda existente
        await supabase.from('vendas').update({
          total: (venda.total || 0) + totalVenda
        }).eq('id', venda.id)
      }

      if (!compraAnexar) {
        // 2. Gerar Compra
        const { data: nC, error: errNumC } = await supabase.rpc('obter_proximo_numero_transacao')
        if (errNumC) throw errNumC
        numCompra = nC

        const { data: c, error: errCompra } = await supabase.from('compras').insert({
          fornecedor,
          data_compra: prepararDataParaInsert(data),
          total: totalCompra,
          status_pagamento: pagCompra.status,
          user_id: user.id,
          numero_transacao: numCompra,
          observacao: `COMPRA CASADA (Simultânea com Venda #${numVenda})`
        }).select().single()
        if (errCompra) throw errCompra
        compra = c
      } else {
        // Atualizar total da compra existente
        await supabase.from('compras').update({
          total: (compra.total || 0) + totalCompra
        }).eq('id', compra.id)
      }

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

      // 4. Gerar Financeiro (Apenas se não for anexo - para simplificar fluxo financeiro)
      if (!vendaAnexar) {
        await criarFinanceiro(totalVenda, cliente, 'entrada', numVenda, pagVenda.status, pagVenda.parcelas, pagVenda.vencimento, pagVenda.prazo)
      }
      if (!compraAnexar) {
        await criarFinanceiro(totalCompra, fornecedor, 'saida', numCompra, pagCompra.status, pagCompra.parcelas, pagCompra.vencimento, pagCompra.prazo)
      }

      alert('✅ Venda Casada gerada com sucesso!')
      clearDraft('venda_casada')
      recarregarDados()
      onSucesso()
      onClose()
    } catch (error: any) {
      const msgErro = formatarErro(error)
      console.error('Erro detalhado (Venda Casada):', error, msgErro)
      alert('Erro: ' + msgErro)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelar = () => {
    if (window.confirm('Deseja realmente cancelar o lançamento de Venda Casada? Todos os dados serão perdidos.')) {
      clearDraft('venda_casada')
      setCliente('')
      setFornecedor('')
      setData(getDataAtualBrasil())
      setItens([{ id: Date.now().toString(), id_produto: '', nome: '', quantidade: 1, preco_unitario: 0, valor_repasse: 0, preco_custo: 0 }])
      setPagVenda({ status: 'pendente', parcelas: 1, vencimento: data, prazo: 'mensal' })
      setPagCompra({ status: 'pago', parcelas: 1, vencimento: data, prazo: 'mensal' })
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center z-[50] p-2 sm:p-4 overflow-y-auto pt-4 pb-20">
      <div className="bg-white w-full max-w-6xl rounded-xl shadow-xl flex flex-col h-fit my-auto overflow-visible min-h-[600px]">
        {/* Header - Mais compacto */}
        <div className="bg-slate-900 text-white px-4 py-2 flex justify-between items-center rounded-t-xl sticky top-0 z-20">
          <h2 className="text-sm font-semibold flex items-center gap-2 uppercase tracking-widest">
            <ShoppingBag className="text-pink-400" size={18} />
            Venda Casada
          </h2>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-2 sm:p-4 space-y-4">
          <div className={`flex justify-between items-center p-2 rounded border ${vendaAnexar ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'}`}>
             <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                  {vendaAnexar ? `📍 ANEXANDO À CASADA #${vendaAnexar.numero_transacao}` : 'LANÇAMENTO ÚNICO'}
                </span>
                {!vendaAnexar && (
                  <button
                    onClick={buscarCasadas}
                    className="bg-yellow-500 text-slate-900 px-2 py-0.5 rounded text-[10px] font-black uppercase shadow-sm hover:bg-yellow-400"
                  >
                    Continuar Venda Casada Existente ➕
                  </button>
                )}
             </div>
             {vendaAnexar && (
               <button
                 onClick={() => { setVendaAnexar(null); setCompraAnexar(null); }}
                 className="text-[10px] font-bold text-red-600 hover:underline"
               >
                 CANCELAR ANEXO
               </button>
             )}
          </div>

          {mostrarBuscaCasada && !vendaAnexar && (
            <div className="bg-yellow-50 border border-yellow-200 p-2 rounded space-y-2">
               <p className="font-bold text-yellow-800 text-[10px] uppercase">Selecione a Venda Casada para adicionar itens:</p>
               <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
                 {casadasAbertas.map(v => (
                   <button
                     key={v.id}
                     onClick={() => selecionarCasadaParaAnexar(v)}
                     className="flex justify-between items-center p-2 bg-white border border-yellow-100 hover:bg-yellow-100 text-left rounded shadow-sm"
                   >
                     <div>
                       <p className="font-bold text-gray-700 text-xs">#{v.numero_transacao} - {v.cliente}</p>
                       <p className="text-[10px] text-gray-500 truncate">{v.observacao}</p>
                     </div>
                     <span className="text-[10px] font-mono bg-yellow-200 px-2 py-0.5 rounded">Selecionar</span>
                   </button>
                 ))}
               </div>
               <button onClick={() => setMostrarBuscaCasada(false)} className="text-[10px] text-slate-500 hover:underline w-full text-center">Fechar busca</button>
            </div>
          )}

          {/* Dados Gerais - Ultra Compacto */}
          <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 ${vendaAnexar ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold text-pink-600 uppercase mb-0.5 ml-1 flex items-center gap-1">
                <ShoppingBag size={10} /> Cliente
              </label>
              <SeletorEntidade
                valor={cliente || ''}
                onChange={setCliente}
                tipo="cliente"
                placeholder="Nome do cliente..."
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold text-blue-600 uppercase mb-0.5 ml-1 flex items-center gap-1">
                <Truck size={10} /> Fornecedor
              </label>
              <SeletorEntidade
                valor={fornecedor || ''}
                onChange={setFornecedor}
                tipo="fornecedor"
                placeholder="Nome do fornecedor..."
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold text-slate-500 uppercase mb-0.5 ml-1">Data</label>
              <input
                type="date"
                value={data || ''}
                onChange={e => setData(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none h-[32px]"
              />
            </div>
          </div>

          {/* Lista Única de Itens - Expansão Vertical Total */}
          <div className="border border-slate-200 rounded-lg shadow-sm bg-white overflow-visible">
            <div className="bg-slate-50 px-3 py-1.5 flex justify-between items-center border-b border-slate-200">
              <h3 className="text-[11px] font-semibold text-slate-700 uppercase tracking-widest">Produtos Vinculados</h3>
              <button onClick={adicionarItem} className="bg-slate-900 text-white px-3 py-1 rounded text-[10px] font-semibold hover:bg-slate-800 transition-colors uppercase tracking-tight">
                + ADICIONAR ITEM
              </button>
            </div>

            <div className="w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-slate-100">
                    <th className="px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase w-[45%]">Produto</th>
                    <th className="px-2 py-2 text-[11px] font-semibold text-slate-500 uppercase text-center w-[10%]">Qtd</th>
                    <th className="px-2 py-2 text-[11px] font-semibold text-pink-600 uppercase text-right w-[18%]">Preço Venda</th>
                    <th className="px-2 py-2 text-[11px] font-semibold text-blue-600 uppercase text-right w-[18%]">Vlr Repasse</th>
                    <th className="px-2 py-2 text-center w-[9%]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {itens.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/30 transition-colors align-top">
                      <td className="px-3 py-3">
                        <SeletorProduto
                          onSelecionarProduto={(p) => selecionarProduto(p, item.id)}
                          placeholder="Buscar produto..."
                          descricaoPreenchida={item.nome || ''}
                        />
                      </td>
                      <td className="px-2 py-3 text-center">
                        <input
                          type="number"
                          value={item.quantidade ?? 0}
                          onChange={e => atualizarItem(item.id, 'quantidade', Number(e.target.value))}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs text-center focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </td>
                      <td className="px-2 py-3">
                        <div className="relative">
                          <span className="absolute left-2 top-2 text-[10px] text-pink-400 font-semibold">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={item.preco_unitario ?? 0}
                            onChange={e => atualizarItem(item.id, 'preco_unitario', Number(e.target.value))}
                            className="w-full border border-pink-200 bg-pink-50/5 rounded pl-7 pr-2 py-1.5 text-xs font-semibold text-pink-700 focus:ring-1 focus:ring-pink-500 outline-none text-right"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <div className="relative">
                          <span className="absolute left-2 top-2 text-[10px] text-blue-400 font-semibold">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={item.valor_repasse ?? 0}
                            onChange={e => atualizarItem(item.id, 'valor_repasse', Number(e.target.value))}
                            className="w-full border border-blue-200 bg-blue-50/5 rounded pl-7 pr-2 py-1.5 text-xs font-semibold text-blue-700 focus:ring-1 focus:ring-blue-500 outline-none text-right"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <button onClick={() => removerItem(item.id)} className="text-red-400 hover:text-red-600 transition-colors p-1.5 bg-red-50 rounded">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financeiro e Pagamentos - Lado a Lado Compacto */}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${vendaAnexar ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
            {/* Pagamento Venda */}
            <div className="bg-pink-50/10 p-3 rounded-lg border border-pink-100 space-y-3">
              <div className="flex justify-between items-center border-b border-pink-100 pb-1.5">
                <h4 className="text-[11px] font-semibold text-pink-700 uppercase tracking-widest flex items-center gap-1">
                  <ShoppingBag size={12} /> Pagamento Venda
                </h4>
                <span className="text-sm font-semibold text-pink-700">R$ {totalVenda.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="flex flex-col">
                  <label className="text-[10px] font-semibold text-pink-600 uppercase mb-0.5 tracking-tighter">Status</label>
                  <select
                    value={pagVenda.status || 'pendente'}
                    onChange={e => setPagVenda({...pagVenda, status: e.target.value})}
                    className="w-full bg-white border border-pink-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-pink-500"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] font-semibold text-pink-600 uppercase mb-0.5 tracking-tighter">Parc.</label>
                  <input
                    type="number"
                    value={pagVenda.parcelas ?? 1}
                    onChange={e => setPagVenda({...pagVenda, parcelas: Math.max(1, Number(e.target.value))})}
                    className="w-full bg-white border border-pink-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-pink-500"
                  />
                </div>
                <div className="flex flex-col lg:col-span-1">
                  <label className="text-[10px] font-semibold text-pink-600 uppercase mb-0.5 tracking-tighter">Vencimento</label>
                  <input
                    type="date"
                    value={pagVenda.vencimento || ''}
                    onChange={e => setPagVenda({...pagVenda, vencimento: e.target.value})}
                    className="w-full bg-white border border-pink-200 rounded px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-pink-500 h-[28px]"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] font-semibold text-pink-600 uppercase mb-0.5 tracking-tighter">Prazo</label>
                  <select
                    value={pagVenda.prazo || 'mensal'}
                    onChange={e => setPagVenda({...pagVenda, prazo: e.target.value})}
                    className="w-full bg-white border border-pink-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-pink-500"
                  >
                    <option value="mensal">Mensal</option>
                    <option value="semanal">Semanal</option>
                    <option value="diaria">Diária</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Pagamento Compra */}
            <div className="bg-blue-50/10 p-3 rounded-lg border border-blue-100 space-y-3">
              <div className="flex justify-between items-center border-b border-blue-100 pb-1.5">
                <h4 className="text-[11px] font-semibold text-blue-700 uppercase tracking-widest flex items-center gap-1">
                  <Truck size={12} /> Pagamento Compra
                </h4>
                <span className="text-sm font-semibold text-blue-700">R$ {totalCompra.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="flex flex-col">
                  <label className="text-[10px] font-semibold text-blue-600 uppercase mb-0.5 tracking-tighter">Status</label>
                  <select
                    value={pagCompra.status || 'pendente'}
                    onChange={e => setPagCompra({...pagCompra, status: e.target.value})}
                    className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] font-semibold text-blue-600 uppercase mb-0.5 tracking-tighter">Parc.</label>
                  <input
                    type="number"
                    value={pagCompra.parcelas ?? 1}
                    onChange={e => setPagCompra({...pagCompra, parcelas: Math.max(1, Number(e.target.value))})}
                    className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex flex-col lg:col-span-1">
                  <label className="text-[10px] font-semibold text-blue-600 uppercase mb-0.5 tracking-tighter">Vencimento</label>
                  <input
                    type="date"
                    value={pagCompra.vencimento || ''}
                    onChange={e => setPagCompra({...pagCompra, vencimento: e.target.value})}
                    className="w-full bg-white border border-blue-200 rounded px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-blue-500 h-[28px]"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] font-semibold text-blue-600 uppercase mb-0.5 tracking-tighter">Prazo</label>
                  <select
                    value={pagCompra.prazo || 'mensal'}
                    onChange={e => setPagCompra({...pagCompra, prazo: e.target.value})}
                    className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
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
          <div className="bg-slate-900 p-3 rounded-lg text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-2 border-t border-pink-500 relative">
            <div className="absolute top-0 left-4 -translate-y-1/2 bg-slate-800 text-[8px] px-2 py-0.5 rounded text-slate-400 font-mono border border-slate-700">
              CORE ENGINE v3.6
            </div>
            <div className="flex gap-4 items-center">
              <div className="text-center md:text-left">
                <p className="text-[8px] uppercase font-semibold text-pink-400">Total Venda</p>
                <p className="text-sm font-semibold font-mono">R$ {totalVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="h-6 w-[1px] bg-white/10 hidden md:block"></div>
              <div className="text-center md:text-left">
                <p className="text-[8px] uppercase font-semibold text-blue-400">Total Compra</p>
                <p className="text-sm font-semibold font-mono">R$ {totalCompra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="h-6 w-[1px] bg-white/10 hidden md:block"></div>
              <div className="text-center md:text-left">
                <p className="text-[8px] uppercase font-semibold text-green-400">Diferença</p>
                <p className={`text-sm font-semibold font-mono ${diferenca >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  R$ {Math.abs(diferenca).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelar}
                className="bg-slate-700 hover:bg-red-700 text-white px-8 py-2.5 rounded-lg font-bold transition-all uppercase tracking-tight text-[11px] shadow-lg active:scale-95 border border-slate-600"
              >
                Cancelar Lançamento
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !cliente || !fornecedor || !itens.some(i => i.id_produto)}
                className="bg-green-600 hover:bg-green-500 disabled:bg-slate-800 disabled:text-slate-500 text-white px-10 py-2.5 rounded-lg font-black transition-all shadow-lg active:scale-95 uppercase tracking-tight text-[11px]"
              >
                {loading ? 'Processando...' : '💰 Finalizar Venda Casada'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
