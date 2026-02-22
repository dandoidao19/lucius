'use client'

import { useState, useEffect, useCallback } from 'react'
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
  preco_unitario: number // Preço de Venda
  valor_repasse: number   // Preço de Custo/Repasse (Compra)
  preco_custo: number     // Custo original do produto
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
  useEffect(() => {
    if (aberto) console.log('🚀 LUCIUS V4.9 - MODAL VENDA CASADA RESTAURADO')
  }, [aberto])

  const { triggerRefresh } = useDadosFinanceiros()
  const { getDraft, setDraft, clearDraft } = useFormDraft()
  const [loading, setLoading] = useState(false)
  const [categorias, setCategorias] = useState<{ id: string; nome: string; percentual_repasse?: number }[]>([])
  const [resetSeletorKey, setResetSeletorKey] = useState(Date.now())

  // Cabeçalho
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

  // Lista Única de Itens
  const [itens, setItens] = useState<ItemVendaCasada[]>([
    { id: Date.now().toString(), id_produto: '', codigo: '', nome: '', quantidade: 1, preco_unitario: 0, valor_repasse: 0, preco_custo: 0, isNovoCadastro: false, minimizado: false }
  ])

  // Pagamentos
  const [pagVenda, setPagVenda] = useState({ status: 'pendente', parcelas: 1, vencimento: data, prazo: 'mensal', acrescimoDesconto: 0 })
  const [pagCompra, setPagCompra] = useState({ status: 'pendente', parcelas: 1, vencimento: data, prazo: 'mensal', acrescimoDesconto: 0 })

  const [casadasAbertas, setCasadasAbertas] = useState<any[]>([])
  const [mostrarBuscaCasada, setMostrarBuscaCasada] = useState(false)
  const [vendaAnexar, setVendaAnexar] = useState<any>(null)
  const [compraAnexar, setCompraAnexar] = useState<any>(null)

  // Efeito para carregar categorias e rascunho
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
        setItens(draft.itens || [{ id: Date.now().toString(), id_produto: '', codigo: '', nome: '', quantidade: 1, preco_unitario: 0, valor_repasse: 0, preco_custo: 0, isNovoCadastro: false, minimizado: false }])
        setPagVenda(draft.pagVenda || { status: 'pendente', parcelas: 1, vencimento: draft.data || getDataAtualBrasil(), prazo: 'mensal' })
        setPagCompra(draft.pagCompra || { status: 'pendente', parcelas: 1, vencimento: draft.data || getDataAtualBrasil(), prazo: 'mensal' })
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

  const resetForm = useCallback(() => {
    setCliente('')
    setFornecedor('')
    setData(getDataAtualBrasil())
    setItens([{ id: Date.now().toString(), id_produto: '', codigo: '', nome: '', quantidade: 1, preco_unitario: 0, valor_repasse: 0, preco_custo: 0, isNovoCadastro: false, minimizado: false }])
    setPagVenda({ status: 'pendente', parcelas: 1, vencimento: getDataAtualBrasil(), prazo: 'mensal', acrescimoDesconto: 0 })
    setPagCompra({ status: 'pendente', parcelas: 1, vencimento: getDataAtualBrasil(), prazo: 'mensal', acrescimoDesconto: 0 })
    setVendaAnexar(null)
    setCompraAnexar(null)
    setIdSaidaAnexar(null)
    setIdEntradaAnexar(null)
    setIdSaidaAnexarIsNovo(false)
    setIdEntradaAnexarIsNovo(false)
    setTotalSaidaAnterior(0)
    setTotalEntradaAnterior(0)
    setResetSeletorKey(Date.now())
  }, [])

  const adicionarItem = () => {
    setItens(prev => {
      const novos = prev.map(i => ({ ...i, minimizado: true }))
      return [...novos, { id: Date.now().toString(), id_produto: '', codigo: '', nome: '', quantidade: 1, preco_unitario: 0, valor_repasse: 0, preco_custo: 0, isNovoCadastro: false, minimizado: false }]
    })
  }

  const removerItem = (id: string) => {
    if (itens.length > 1) {
      setItens(itens.filter(i => i.id !== id))
    }
  }

  const atualizarItem = (id: string, campo: keyof ItemVendaCasada, valor: any) => {
    setItens(prev => prev.map(i => {
      if (i.id === id) {
        const itemAtualizado = { ...i, [campo]: valor }

        if (campo === 'preco_custo' || campo === 'categoria') {
          const categoriaNome = campo === 'categoria' ? String(valor) : itemAtualizado.categoria
          const precoCusto = campo === 'preco_custo' ? Number(valor) : itemAtualizado.preco_custo

          const cat = categorias.find(c => c.nome === categoriaNome)
          if (cat && precoCusto > 0) {
            itemAtualizado.valor_repasse = precoCusto * (1 + (cat.percentual_repasse || 0) / 100)
          } else {
            itemAtualizado.valor_repasse = precoCusto
          }
        }
        return itemAtualizado
      }
      return i
    }))
  }

  const toggleNovoCadastro = (id: string) => {
    setItens(prev => prev.map(i => i.id === id ? {
      ...i,
      isNovoCadastro: !i.isNovoCadastro,
      id_produto: '',
      codigo: '',
      nome: '',
      categoria: !i.isNovoCadastro ? categorias[0]?.nome || '' : '',
      preco_custo: 0,
      valor_repasse: 0,
      preco_unitario: 0
    } : i))
    setResetSeletorKey(Date.now())
  }

  const selecionarProduto = (produto: any, id: string) => {
    setItens(prev => prev.map(i => i.id === id ? {
      ...i,
      id_produto: produto.id,
      codigo: produto.codigo || '',
      nome: produto.descricao,
      categoria: produto.categoria || '',
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
    let mensagem = err.message || 'Erro interno'
    if (err.details) mensagem += ` (Detalhes: ${err.details})`
    if (err.code) mensagem += ` [Código: ${err.code}]`
    return mensagem
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
        user_id: user.id,
        numero_transacao: refNum,
        descricao: `${tipo === 'entrada' ? 'Venda' : 'Compra'} ${entidade} (${i}/${qtdParcelas})`,
        total: i === qtdParcelas ? valorUltima : valorBase,
        tipo,
        data: prepararDataParaInsert(dtP),
        status_pagamento: i === 1 && total > 0 ? status : 'pendente',
        observacao: isPedido ? `[PEDIDO] Ref. #${refNum}` : `Ref. #${refNum}`,
        quantidade_parcelas: qtdParcelas,
        ...parentIds
      })
    }
    const { error } = await supabase.from('transacoes_loja').insert(transacoes)
    if (error) throw error
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
      setTotalSaidaAnterior(venda.total || 0)
      const match = venda.observacao.match(/Transação #(\d+)/) || venda.observacao.match(/Compra #(\d+)/)
      let compraEncontrada = null

      if (match && match[1]) {
        const numCompra = parseInt(match[1])
        const { data: c } = await supabase.from('compras').select('*').eq('numero_transacao', numCompra).single()
        compraEncontrada = c
      }

      setVendaAnexar(venda)
      setCompraAnexar(compraEncontrada)
      if (compraEncontrada) setTotalEntradaAnterior(compraEncontrada.total || 0)
      setCliente(venda.cliente)
      if (compraEncontrada) setFornecedor(compraEncontrada.fornecedor)
      setData(venda.data_venda.split('T')[0])

      if (venda.quantidade_parcelas) setPagVenda(prev => ({ ...prev, parcelas: venda.quantidade_parcelas }))
      if (venda.prazoparcelas) setPagVenda(prev => ({ ...prev, prazo: venda.prazoparcelas }))

      if (compraEncontrada) {
        if (compraEncontrada.quantidade_parcelas) setPagCompra(prev => ({ ...prev, parcelas: compraEncontrada.quantidade_parcelas }))
        if (compraEncontrada.prazoparcelas) setPagCompra(prev => ({ ...prev, prazo: compraEncontrada.prazoparcelas }))
      }

      setTipoSaida('venda')
      setTipoEntrada('compra')
      setMostrarBuscaCasada(false)
    } catch (err) {
      console.error('Erro ao vincular compra casada:', err)
      alert('Erro ao encontrar compra vinculada.')
    }
  }

  const buscarPedidos = async (tipoLado: 'enviado' | 'recebido') => {
    try {
      const { data: pNovo, error: eNovo } = await supabase
        .from('pedidos_loja')
        .select('*')
        .eq('tipo', tipoLado === 'enviado' ? 'venda' : 'compra')
        .in('status', ['pendente', 'parcial'])
        .order('data_pedido', { ascending: false })

      const { data: pAntigo, error: eAntigo } = await supabase
        .from('transacoes_condicionais')
        .select('*')
        .eq('tipo', tipoLado)
        .eq('status', 'pendente')
        .ilike('observacao', '%[PEDIDO]%')
        .order('data_transacao', { ascending: false })

      if (eNovo || eAntigo) throw (eNovo || eAntigo)

      const unificados = [
        ...(pNovo || []).map(p => ({ ...p, isNovo: true, origem: p.entidade, data_transacao: p.data_pedido, total: p.total_geral })),
        ...(pAntigo || []).map(p => ({ ...p, isNovo: false }))
      ]

      if (tipoLado === 'enviado') {
        setPedidosSaidaAbertos(unificados)
        setMostrarBuscaSaida(true)
      } else {
        setPedidosEntradaAbertos(unificados)
        setMostrarBuscaEntrada(true)
      }
    } catch (err) {
      console.error('Erro ao buscar pedidos:', err)
    }
  }

  const selecionarPedidoLado = (pedido: any, lado: 'saida' | 'entrada') => {
    if (!window.confirm(`Deseja anexar ao Pedido #${pedido.numero_transacao}?`)) return

    if (lado === 'saida') {
      setIdSaidaAnexar(pedido.id)
      setIdSaidaAnexarIsNovo(!!pedido.isNovo)
      setTotalSaidaAnterior(pedido.total || 0)
      setCliente(pedido.origem || pedido.entidade)
      setData((pedido.data_transacao || pedido.data_pedido).split('T')[0])
      if (pedido.quantidade_parcelas) setPagVenda(prev => ({ ...prev, parcelas: pedido.quantidade_parcelas }))
      if (pedido.prazoparcelas) setPagVenda(prev => ({ ...prev, prazo: pedido.prazoparcelas }))
      if (pedido.data_vencimento) setPagVenda(prev => ({ ...prev, vencimento: pedido.data_vencimento.split('T')[0] }))
      setMostrarBuscaSaida(false)
    } else {
      setIdEntradaAnexar(pedido.id)
      setIdEntradaAnexarIsNovo(!!pedido.isNovo)
      setTotalEntradaAnterior(pedido.total || 0)
      setFornecedor(pedido.origem || pedido.entidade)
      setData((pedido.data_transacao || pedido.data_pedido).split('T')[0])
      if (pedido.quantidade_parcelas) setPagCompra(prev => ({ ...prev, parcelas: pedido.quantidade_parcelas }))
      if (pedido.prazoparcelas) setPagCompra(prev => ({ ...prev, prazo: pedido.prazoparcelas }))
      if (pedido.data_vencimento) setPagCompra(prev => ({ ...prev, vencimento: pedido.data_vencimento.split('T')[0] }))
      setMostrarBuscaEntrada(false)
    }
  }

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

      let numSaida = n1
      let numEntrada = n2

      if (vendaAnexar) {
        numSaida = vendaAnexar.numero_transacao
        numEntrada = compraAnexar?.numero_transacao || numSaida
      } else if (idSaidaAnexar) {
        const table = idSaidaAnexarIsNovo ? 'pedidos_loja' : 'transacoes_condicionais'
        const { data: p } = await supabase.from(table).select('numero_transacao').eq('id', idSaidaAnexar).single()
        numSaida = p?.numero_transacao || 0
      } else if (idEntradaAnexar) {
        const table = idEntradaAnexarIsNovo ? 'pedidos_loja' : 'transacoes_condicionais'
        const { data: p } = await supabase.from(table).select('numero_transacao').eq('id', idEntradaAnexar).single()
        numEntrada = p?.numero_transacao || 0
      }

      const obsSaida = tipoSaida.startsWith('pedido') ? "PEDIDO AGUARDANDO FECHAMENTO" : `VENDA CASADA (Simultânea com Transação #${numEntrada})`
      const obsEntrada = tipoEntrada.startsWith('pedido') ? "PEDIDO AGUARDANDO FECHAMENTO" : `VENDA CASADA (Simultânea com Transação #${numSaida})`

      const totalVendaFinal = totalVenda + pagVenda.acrescimoDesconto
      const totalCompraFinal = totalCompra + pagCompra.acrescimoDesconto
      const totalItensQtdNovos = itensValidos.reduce((acc, i) => acc + i.quantidade, 0)

      let idSaida = null
      if (tipoSaida === 'venda') {
        if (vendaAnexar) {
          idSaida = vendaAnexar.id
          const totalFinal = (vendaAnexar.total || 0) + totalVendaFinal
          const acrescimo = (pagVenda.acrescimoDesconto > 0 ? pagVenda.acrescimoDesconto : 0) + (vendaAnexar.acrescimo || 0)
          const desconto = (pagVenda.acrescimoDesconto < 0 ? Math.abs(pagVenda.acrescimoDesconto) : 0) + (vendaAnexar.desconto || 0)

          await supabase.from('vendas').update({
            total: totalFinal,
            quantidade_itens: (vendaAnexar.quantidade_itens || 0) + totalItensQtdNovos,
            acrescimo,
            desconto,
            data_vencimento: prepararDataParaInsert(pagVenda.vencimento)
          }).eq('id', idSaida)
          await supabase.from('transacoes_loja').delete().eq('id_venda', idSaida)
          await criarFinanceiro(totalFinal, cliente, 'entrada', numSaida, pagVenda.status, pagVenda.parcelas, pagVenda.vencimento, pagVenda.prazo, { id_venda: idSaida })
        } else {
          const { data: v } = await supabase.from('vendas').insert({
            cliente,
            data_venda: prepararDataParaInsert(data),
            total: totalVendaFinal,
            status_pagamento: pagVenda.status,
            user_id: user.id,
            numero_transacao: numSaida,
            observacao: obsSaida,
            quantidade_parcelas: pagVenda.parcelas,
            prazoparcelas: pagVenda.prazo,
            quantidade_itens: totalItensQtdNovos,
            acrescimo: pagVenda.acrescimoDesconto > 0 ? pagVenda.acrescimoDesconto : 0,
            desconto: pagVenda.acrescimoDesconto < 0 ? Math.abs(pagVenda.acrescimoDesconto) : 0,
            data_vencimento: prepararDataParaInsert(pagVenda.vencimento)
          }).select().single()
          idSaida = v.id; await criarFinanceiro(totalVendaFinal, cliente, 'entrada', numSaida, pagVenda.status, pagVenda.parcelas, pagVenda.vencimento, pagVenda.prazo, { id_venda: idSaida })
        }
      } else {
        if (idSaidaAnexar) {
          idSaida = idSaidaAnexar
          const table = idSaidaAnexarIsNovo ? 'pedidos_loja' : 'transacoes_condicionais'
          const colTotal = idSaidaAnexarIsNovo ? 'total_geral' : 'total'
          const { data: pOld } = await supabase.from(table).select(`${colTotal}, quantidade_itens, acrescimo, desconto`).eq('id', idSaida).single()
          const totalFinal = ((pOld as any)?.[colTotal] || 0) + totalVendaFinal
          const totalQtdFinal = ((pOld as any)?.quantidade_itens || 0) + totalItensQtdNovos
          const acrescimo = (pagVenda.acrescimoDesconto > 0 ? pagVenda.acrescimoDesconto : 0) + ((pOld as any)?.acrescimo || 0)
          const desconto = (pagVenda.acrescimoDesconto < 0 ? Math.abs(pagVenda.acrescimoDesconto) : 0) + ((pOld as any)?.desconto || 0)

          await supabase.from(table).update({
            [colTotal]: totalFinal,
            [idSaidaAnexarIsNovo ? 'total_financeiro' : 'total']: totalFinal,
            quantidade_itens: totalQtdFinal,
            quantidade_parcelas: pagVenda.parcelas,
            prazoparcelas: pagVenda.prazo,
            data_vencimento: prepararDataParaInsert(pagVenda.vencimento),
            acrescimo,
            desconto
          }).eq('id', idSaida)
          await supabase.from('transacoes_loja').delete().eq(idSaidaAnexarIsNovo ? 'id_pedido' : 'id_condicional', idSaida)
          await criarFinanceiro(totalFinal, cliente, 'entrada', numSaida, 'pendente', pagVenda.parcelas, pagVenda.vencimento, pagVenda.prazo, { [idSaidaAnexarIsNovo ? 'id_pedido' : 'id_condicional']: idSaida }, true)
        } else {
          const { data: p } = await supabase.from('pedidos_loja').insert({
            entidade: cliente,
            data_pedido: prepararDataParaInsert(data),
            tipo: 'venda',
            status: 'pendente',
            numero_transacao: numSaida,
            total_geral: totalVendaFinal,
            total_financeiro: totalVendaFinal,
            observacao: obsSaida,
            user_id: user.id,
            quantidade_parcelas: pagVenda.parcelas,
            prazoparcelas: pagVenda.prazo,
            data_vencimento: prepararDataParaInsert(pagVenda.vencimento),
            acrescimo: pagVenda.acrescimoDesconto > 0 ? pagVenda.acrescimoDesconto : 0,
            desconto: pagVenda.acrescimoDesconto < 0 ? Math.abs(pagVenda.acrescimoDesconto) : 0
          }).select().single()
          idSaida = p.id; await criarFinanceiro(totalVendaFinal, cliente, 'entrada', numSaida, 'pendente', pagVenda.parcelas, pagVenda.vencimento, pagVenda.prazo, { id_pedido: idSaida }, true)
        }
      }

      let idEntrada = null
      if (tipoEntrada === 'compra') {
        if (compraAnexar) {
          idEntrada = compraAnexar.id
          const totalFinal = (compraAnexar.total || 0) + totalCompraFinal
          const acrescimo = (pagCompra.acrescimoDesconto > 0 ? pagCompra.acrescimoDesconto : 0) + (compraAnexar.acrescimo || 0)
          const desconto = (pagCompra.acrescimoDesconto < 0 ? Math.abs(pagCompra.acrescimoDesconto) : 0) + (compraAnexar.desconto || 0)

          await supabase.from('compras').update({
            total: totalFinal,
            quantidade_itens: (compraAnexar.quantidade_itens || 0) + totalItensQtdNovos,
            acrescimo,
            desconto,
            data_vencimento: prepararDataParaInsert(pagCompra.vencimento)
          }).eq('id', idEntrada)
          await supabase.from('transacoes_loja').delete().eq('id_compra', idEntrada)
          await criarFinanceiro(totalFinal, fornecedor, 'saida', numEntrada, pagCompra.status, pagCompra.parcelas, pagCompra.vencimento, pagCompra.prazo, { id_compra: idEntrada })
        } else {
          const { data: c } = await supabase.from('compras').insert({
            fornecedor,
            data_compra: prepararDataParaInsert(data),
            total: totalCompraFinal,
            status_pagamento: pagCompra.status,
            user_id: user.id,
            numero_transacao: numEntrada,
            observacao: obsEntrada,
            quantidade_parcelas: pagCompra.parcelas,
            prazoparcelas: pagCompra.prazo,
            quantidade_itens: totalItensQtdNovos,
            acrescimo: pagCompra.acrescimoDesconto > 0 ? pagCompra.acrescimoDesconto : 0,
            desconto: pagCompra.acrescimoDesconto < 0 ? Math.abs(pagCompra.acrescimoDesconto) : 0,
            data_vencimento: prepararDataParaInsert(pagCompra.vencimento)
          }).select().single()
          idEntrada = c.id; await criarFinanceiro(totalCompraFinal, fornecedor, 'saida', numEntrada, pagCompra.status, pagCompra.parcelas, pagCompra.vencimento, pagCompra.prazo, { id_compra: idEntrada })
        }
      } else {
        if (idEntradaAnexar) {
          idEntrada = idEntradaAnexar
          const table = idEntradaAnexarIsNovo ? 'pedidos_loja' : 'transacoes_condicionais'
          const colTotal = idEntradaAnexarIsNovo ? 'total_geral' : 'total'
          const { data: pOld } = await supabase.from(table).select(`${colTotal}, quantidade_itens, acrescimo, desconto`).eq('id', idEntrada).single()
          const totalFinal = ((pOld as any)?.[colTotal] || 0) + totalCompraFinal
          const totalQtdFinal = ((pOld as any)?.quantidade_itens || 0) + totalItensQtdNovos
          const acrescimo = (pagCompra.acrescimoDesconto > 0 ? pagCompra.acrescimoDesconto : 0) + ((pOld as any)?.acrescimo || 0)
          const desconto = (pagCompra.acrescimoDesconto < 0 ? Math.abs(pagCompra.acrescimoDesconto) : 0) + ((pOld as any)?.desconto || 0)

          await supabase.from(table).update({
            [colTotal]: totalFinal,
            [idEntradaAnexarIsNovo ? 'total_financeiro' : 'total']: totalFinal,
            quantidade_itens: totalQtdFinal,
            quantidade_parcelas: pagCompra.parcelas,
            prazoparcelas: pagCompra.prazo,
            data_vencimento: prepararDataParaInsert(pagCompra.vencimento),
            acrescimo,
            desconto
          }).eq('id', idEntrada)
          await supabase.from('transacoes_loja').delete().eq(idEntradaAnexarIsNovo ? 'id_pedido' : 'id_condicional', idEntrada)
          await criarFinanceiro(totalFinal, fornecedor, 'saida', numEntrada, 'pendente', pagCompra.parcelas, pagCompra.vencimento, pagCompra.prazo, { [idEntradaAnexarIsNovo ? 'id_pedido' : 'id_condicional']: idEntrada }, true)
        } else {
          const { data: p } = await supabase.from('pedidos_loja').insert({
            entidade: fornecedor,
            data_pedido: prepararDataParaInsert(data),
            tipo: 'compra',
            status: 'pendente',
            numero_transacao: numEntrada,
            total_geral: totalCompraFinal,
            total_financeiro: totalCompraFinal,
            observacao: obsEntrada,
            user_id: user.id,
            quantidade_parcelas: pagCompra.parcelas,
            prazoparcelas: pagCompra.prazo,
            data_vencimento: prepararDataParaInsert(pagCompra.vencimento),
            acrescimo: pagCompra.acrescimoDesconto > 0 ? pagCompra.acrescimoDesconto : 0,
            desconto: pagCompra.acrescimoDesconto < 0 ? Math.abs(pagCompra.acrescimoDesconto) : 0
          }).select().single()
          idEntrada = p.id; await criarFinanceiro(totalCompraFinal, fornecedor, 'saida', numEntrada, 'pendente', pagCompra.parcelas, pagCompra.vencimento, pagCompra.prazo, { id_pedido: idEntrada }, true)
        }
      }

      for (const item of itensValidos) {
        let prodId = item.id_produto
        if (item.isNovoCadastro && !prodId) {
          const { data: nP } = await supabase.from('produtos').insert({ descricao: item.nome.toUpperCase(), categoria: item.categoria, preco_custo: item.preco_custo, valor_repasse: item.valor_repasse, preco_venda: item.preco_unitario, quantidade: 0, user_id: user.id }).select().single()
          prodId = nP.id
        }
        const commonS = { produto_id: prodId, descricao: item.nome, quantidade: item.quantidade, preco_venda: item.preco_unitario, preco_custo: item.preco_custo, valor_repasse: item.valor_repasse, categoria: item.categoria }
        if (tipoSaida === 'venda') await supabase.from('itens_venda').insert({ venda_id: idSaida, ...commonS, observacao: `Vinculado a transação #${numEntrada}` })
        else await supabase.from((idSaidaAnexarIsNovo || (!idSaidaAnexar && tipoSaida === 'pedido_venda')) ? 'itens_pedido_loja' : 'itens_condicionais').insert({ [(idSaidaAnexarIsNovo || (!idSaidaAnexar && tipoSaida === 'pedido_venda')) ? 'pedido_id' : 'transacao_id']: idSaida, ...commonS, status: 'pendente', [(idSaidaAnexarIsNovo || (!idSaidaAnexar && tipoSaida === 'pedido_venda')) ? 'observacao_item' : 'observacao']: `Vinculado a transação #${numEntrada}` })

        const commonE = { produto_id: prodId, descricao: item.nome, quantidade: item.quantidade, preco_custo: item.preco_custo, valor_repasse: item.valor_repasse, preco_venda: item.preco_unitario, categoria: item.categoria }
        if (tipoEntrada === 'compra') await supabase.from('itens_compra').insert({ compra_id: idEntrada, ...commonE, observacao: `Vinculado a transação #${numSaida}` })
        else await supabase.from((idEntradaAnexarIsNovo || (!idEntradaAnexar && tipoEntrada === 'pedido_compra')) ? 'itens_pedido_loja' : 'itens_condicionais').insert({ [(idEntradaAnexarIsNovo || (!idEntradaAnexar && tipoEntrada === 'pedido_compra')) ? 'pedido_id' : 'transacao_id']: idEntrada, ...commonE, status: 'pendente', [(idEntradaAnexarIsNovo || (!idEntradaAnexar && tipoEntrada === 'pedido_compra')) ? 'observacao_item' : 'observacao']: `Vinculado a transação #${numSaida}` })

        if (prodId) {
          if (tipoSaida !== 'pedido_venda') {
            await supabase.rpc('atualizar_estoque', { produto_id_param: prodId, quantidade_param: -Math.round(item.quantidade) })
            await supabase.from('movimentacoes_estoque').insert({ produto_id: prodId, tipo: 'saida', quantidade: item.quantidade, observacao: `Transação #${numSaida}` })
          }
          if (tipoEntrada !== 'pedido_compra') {
            await supabase.rpc('atualizar_estoque', { produto_id_param: prodId, quantidade_param: Math.round(item.quantidade) })
            await supabase.from('produtos').update({ preco_custo: item.preco_custo, valor_repasse: item.valor_repasse, preco_venda: item.preco_unitario, data_ultima_compra: prepararDataParaInsert(data) }).eq('id', prodId)
            await supabase.from('movimentacoes_estoque').insert({ produto_id: prodId, tipo: 'entrada', quantidade: item.quantidade, observacao: `Transação #${numEntrada}` })
          }
        }
      }

      triggerRefresh()
      onSucesso()
      setTimeout(() => alert('✅ Venda Casada processada com sucesso!'), 100)
      clearDraft('venda_casada')
      resetForm()
      onClose()
    } catch (err: any) {
      alert('Erro: ' + formatarErro(err))
    } finally {
      setLoading(false)
    }
  }

  const handleCancelar = () => {
    if (window.confirm('Deseja realmente cancelar? Todos os dados preenchidos serão perdidos.')) {
      clearDraft('venda_casada')
      resetForm()
      onClose()
    }
  }

  if (!aberto) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center z-[50] p-2 sm:p-4 overflow-y-auto pt-4 pb-20">
      <div className="bg-white w-full max-w-6xl rounded-xl shadow-xl flex flex-col h-fit my-auto min-h-[600px] border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 py-2 flex justify-between items-center rounded-t-xl sticky top-0 z-20">
          <h2 className="text-sm font-semibold flex items-center gap-2 uppercase tracking-widest">
            <ShoppingBag className="text-pink-400" size={18} />
            Venda Casada (LUCIUS v5.4)
          </h2>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className={`flex justify-between items-center p-2 rounded border ${vendaAnexar ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'}`}>
             <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                  {vendaAnexar ? `📍 ANEXANDO À CASADA #${vendaAnexar.numero_transacao}` : 'LANÇAMENTO NOVO'}
                </span>
                {!vendaAnexar && !idSaidaAnexar && !idEntradaAnexar && (
                  <button onClick={buscarCasadas} className="bg-purple-600 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase hover:bg-purple-500 transition-colors">
                    Venda Casada Existente ➕
                  </button>
                )}
             </div>
             {(vendaAnexar || idSaidaAnexar || idEntradaAnexar) && (
               <button onClick={resetForm} className="text-[10px] font-bold text-red-600 hover:underline">CANCELAR ANEXO</button>
             )}
          </div>

          {!vendaAnexar && (
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-2 rounded border border-slate-200 shadow-sm">
               <div className="space-y-2">
                 <label className="text-[10px] font-bold text-slate-600 uppercase">1. Tipo de Saída</label>
                 <div className="flex gap-2">
                    <button onClick={() => { setTipoSaida('venda'); setIdSaidaAnexar(null); }} className={`flex-1 py-1 text-[10px] font-bold rounded border transition-all ${tipoSaida === 'venda' ? 'bg-green-600 text-white border-green-700 shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}>💰 VENDA</button>
                    <button onClick={() => setTipoSaida('pedido_venda')} className={`flex-1 py-1 text-[10px] font-bold rounded border transition-all ${tipoSaida === 'pedido_venda' ? 'bg-yellow-500 text-slate-900 border-yellow-600 shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}>📝 PEDIDO VENDA</button>
                 </div>
                 {tipoSaida === 'pedido_venda' && <button onClick={() => buscarPedidos('enviado')} className={`w-full py-1 text-[9px] font-black rounded border-2 border-dashed ${idSaidaAnexar ? 'bg-orange-50 border-orange-400 text-orange-700' : 'border-yellow-400 text-yellow-700'} uppercase`}>{idSaidaAnexar ? '📍 Pedido Saída Selecionado' : '➕ Anexar a Pedido Venda exist.'}</button>}
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-bold text-slate-600 uppercase">2. Tipo de Entrada</label>
                 <div className="flex gap-2">
                    <button onClick={() => { setTipoEntrada('compra'); setIdEntradaAnexar(null); }} className={`flex-1 py-1 text-[10px] font-bold rounded border transition-all ${tipoEntrada === 'compra' ? 'bg-blue-600 text-white border-blue-700 shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}>📥 COMPRA</button>
                    <button onClick={() => setTipoEntrada('pedido_compra')} className={`flex-1 py-1 text-[10px] font-bold rounded border transition-all ${tipoEntrada === 'pedido_compra' ? 'bg-orange-500 text-white border-orange-600 shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}>📦 PEDIDO COMPRA</button>
                 </div>
                 {tipoEntrada === 'pedido_compra' && <button onClick={() => buscarPedidos('recebido')} className={`w-full py-1 text-[9px] font-black rounded border-2 border-dashed ${idEntradaAnexar ? 'bg-orange-50 border-orange-400 text-orange-700' : 'border-orange-400 text-orange-700'} uppercase`}>{idEntradaAnexar ? '📍 Pedido Entrada Selecionado' : '➕ Anexar a Pedido Compra exist.'}</button>}
               </div>
            </div>
          )}

          {mostrarBuscaSaida && (
            <div className="bg-yellow-50 border border-yellow-200 p-2 rounded max-h-32 overflow-y-auto">
               {pedidosSaidaAbertos.map(p => <button key={p.id} onClick={() => selecionarPedidoLado(p, 'saida')} className="w-full text-left p-2 border-b hover:bg-yellow-100 flex justify-between items-center"><div className="text-xs"><b>#{p.numero_transacao}</b> - {p.origem || p.entidade}</div><span className="text-[9px] bg-yellow-200 px-1 rounded">Vincular</span></button>)}
            </div>
          )}

          {mostrarBuscaEntrada && (
            <div className="bg-orange-50 border border-orange-200 p-2 rounded max-h-32 overflow-y-auto">
               {pedidosEntradaAbertos.map(p => <button key={p.id} onClick={() => selecionarPedidoLado(p, 'entrada')} className="w-full text-left p-2 border-b hover:bg-orange-100 flex justify-between items-center"><div className="text-xs"><b>#{p.numero_transacao}</b> - {p.origem || p.entidade}</div><span className="text-[9px] bg-orange-200 px-1 rounded">Vincular</span></button>)}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col"><label className="text-[11px] font-semibold text-pink-600 uppercase mb-1 ml-1 flex items-center gap-1"><ShoppingBag size={10} /> Cliente</label><SeletorEntidade valor={cliente} onChange={setCliente} tipo="cliente" placeholder="Nome..." disabled={!!vendaAnexar || !!idSaidaAnexar} /></div>
            <div className="flex flex-col"><label className="text-[11px] font-semibold text-blue-600 uppercase mb-1 ml-1 flex items-center gap-1"><Truck size={10} /> Fornecedor</label><SeletorEntidade valor={fornecedor} onChange={setFornecedor} tipo="fornecedor" placeholder="Nome..." disabled={!!compraAnexar || !!idEntradaAnexar} /></div>
            <div className="flex flex-col"><label className="text-[11px] font-semibold text-slate-500 uppercase mb-1 ml-1">Data</label><input type="date" value={data} onChange={e => setData(e.target.value)} className="w-full border rounded px-2 py-1 text-xs h-[34px] focus:ring-1 focus:ring-pink-500 outline-none" disabled={!!vendaAnexar || !!idSaidaAnexar} /></div>
          </div>

          <div className="border border-slate-200 rounded-lg shadow-sm bg-white overflow-visible">
            <div className="bg-slate-50 px-3 py-1.5 flex justify-between items-center border-b"><h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">Produtos Vinculados</h3><button onClick={adicionarItem} className="bg-slate-900 text-white px-3 py-1 rounded text-[10px] font-bold hover:bg-slate-800 transition-colors uppercase tracking-tight">+ ADICIONAR ITEM</button></div>
            <div className="p-2 space-y-2">
              {itens.map((it, idx) => (
                <div key={it.id} className={`border rounded p-2 transition-colors ${it.minimizado ? 'bg-slate-50' : 'bg-pink-50/10 border-pink-200 shadow-inner'}`}>
                  {it.minimizado ? (
                    <div className="flex justify-between items-center cursor-pointer" onClick={() => atualizarItem(it.id, 'minimizado', false)}><span className="text-[11px] font-semibold text-slate-700 uppercase">{idx + 1}. {it.nome || '(Busque um produto)'} - {it.quantidade}x (V: R${it.preco_unitario.toFixed(2)} | C: R${it.valor_repasse.toFixed(2)})</span><div className="flex gap-2"><button onClick={(e) => { e.stopPropagation(); atualizarItem(it.id, 'minimizado', false); }} className="text-blue-600 text-[10px] font-bold">EDITAR</button><button onClick={(e) => { e.stopPropagation(); removerItem(it.id); }} className="text-red-600 text-[10px] font-bold">REMOVER</button></div></div>
                  ) : (
                    <div className="space-y-3">
                       <div className="flex justify-between items-center"><span className="text-[11px] font-black text-pink-700 uppercase">Item {idx + 1}</span><label className="flex items-center gap-1.5 cursor-pointer bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm"><input type="checkbox" checked={it.isNovoCadastro} onChange={() => toggleNovoCadastro(it.id)} className="w-3.5 h-3.5 accent-pink-600" /><span className="text-[10px] font-bold text-slate-600 uppercase">Novo Cadastro</span></label></div>
                       {!it.isNovoCadastro ? <SeletorProduto key={`sel-${resetSeletorKey}-${it.id}`} onSelecionarProduto={p => selecionarProduto(p, it.id)} placeholder="Buscar produto..." descricaoPreenchida={it.nome} /> :
                       <div className="space-y-2"><div className="grid grid-cols-3 gap-2"><div><label className="text-[10px] font-bold text-slate-500 uppercase">Código</label><input type="text" value={it.codigo} onChange={e => atualizarItem(it.id, 'codigo', e.target.value)} className="w-full px-2 py-1 text-xs border rounded font-mono" /></div><div className="col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase">Descrição *</label><input type="text" value={it.nome} onChange={e => atualizarItem(it.id, 'nome', e.target.value)} className="w-full px-2 py-1 text-xs border rounded" /></div></div><div className="grid grid-cols-2 gap-2"><div><label className="text-[10px] font-bold text-slate-500 uppercase">Categoria</label><select value={it.categoria} onChange={e => atualizarItem(it.id, 'categoria', e.target.value)} className="w-full px-2 py-1 text-xs border rounded bg-white">{categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}</select></div><div><label className="text-[10px] font-bold text-slate-500 uppercase">Qtd</label><input type="number" value={it.quantidade} onChange={e => atualizarItem(it.id, 'quantidade', Number(e.target.value))} className="w-full px-2 py-1 text-xs border rounded" /></div></div></div>}
                       <div className="grid grid-cols-3 gap-2">
                          <div><label className="block text-[10px] font-bold text-red-600 uppercase">Custo *</label><input type="number" step="0.01" value={it.preco_custo} onChange={e => atualizarItem(it.id, 'preco_custo', Number(e.target.value))} className="w-full px-2 py-1 text-xs border border-red-200 rounded font-semibold" /></div>
                          <div><label className="block text-[10px] font-bold text-orange-600 uppercase">Repasse</label><input type="number" step="0.01" value={it.valor_repasse} onChange={e => atualizarItem(it.id, 'valor_repasse', Number(e.target.value))} className="w-full px-2 py-1 text-xs border border-orange-200 rounded bg-orange-50/30" /></div>
                          <div><label className="block text-[10px] font-bold text-green-600 uppercase">Venda *</label><input type="number" step="0.01" value={it.preco_unitario} onChange={e => atualizarItem(it.id, 'preco_unitario', Number(e.target.value))} className="w-full px-2 py-1 text-xs border border-green-200 rounded font-semibold" /></div>
                       </div>
                       <div className="flex justify-end gap-3 pt-1 border-t border-pink-100"><button onClick={() => atualizarItem(it.id, 'minimizado', true)} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase">Minimizar</button><button onClick={() => removerItem(it.id)} className="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase">Remover</button></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${(vendaAnexar || (idSaidaAnexar && idEntradaAnexar)) ? 'hidden' : ''}`}>
            <div className={`bg-pink-50/10 p-3 rounded-lg border border-pink-100 space-y-3 ${idSaidaAnexar ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
              <div className="flex justify-between items-center border-b border-pink-100 pb-1.5">
                <h4 className="text-[11px] font-bold text-pink-700 uppercase">Pagamento Venda</h4>
                <div className="flex items-center gap-2">
                  <label className="text-[9px] font-bold text-pink-600 uppercase">Acresc./Desc.</label>
                  <input type="number" value={pagVenda.acrescimoDesconto} onChange={e => setPagVenda({...pagVenda, acrescimoDesconto: Number(e.target.value)})} className="w-16 border rounded px-1 py-0.5 text-[10px] bg-white" placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="flex flex-col"><label className="text-[10px] font-semibold text-pink-600 uppercase tracking-tighter">Status</label><select value={pagVenda.status} onChange={e => setPagVenda({...pagVenda, status: e.target.value})} className="border rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-pink-500 outline-none"><option value="pendente">Pendente</option><option value="pago">Pago</option></select></div>
                <div className="flex flex-col"><label className="text-[10px] font-semibold text-pink-600 uppercase tracking-tighter">Parc.</label><input type="number" value={pagVenda.parcelas} onChange={e => setPagVenda({...pagVenda, parcelas: Math.max(1, Number(e.target.value))})} className="border rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-pink-500 outline-none" /></div>
                <div className="flex flex-col"><label className="text-[10px] font-semibold text-pink-600 uppercase tracking-tighter">Venc.</label><input type="date" value={pagVenda.vencimento} onChange={e => setPagVenda({...pagVenda, vencimento: e.target.value})} className="border rounded px-1 py-1 text-[10px] bg-white h-[28px] focus:ring-1 focus:ring-pink-500 outline-none" /></div>
                <div className="flex flex-col"><label className="text-[10px] font-semibold text-pink-600 uppercase tracking-tighter">Prazo</label><select value={pagVenda.prazo} onChange={e => setPagVenda({...pagVenda, prazo: e.target.value})} className="border rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-pink-500 outline-none"><option value="mensal">Mensal</option><option value="semanal">Semanal</option><option value="diaria">Diária</option></select></div>
              </div>

              {/* Preview Parcelas Venda */}
              {pagVenda.parcelas > 1 && (
                <div className="mt-2 bg-pink-50/30 p-2 rounded-lg border border-pink-100 max-h-32 overflow-y-auto shadow-inner custom-scrollbar">
                  <div className="grid grid-cols-2 gap-1.5">
                    {Array.from({ length: Math.min(pagVenda.parcelas, 48) }).map((_, i) => {
                      const valorBase = Math.floor(((totalVenda + pagVenda.acrescimoDesconto) / pagVenda.parcelas) * 100) / 100
                      const valorUltima = Number(((totalVenda + pagVenda.acrescimoDesconto) - (valorBase * (pagVenda.parcelas - 1))).toFixed(2))
                      let dtP = pagVenda.vencimento
                      if (i > 0 && pagVenda.vencimento) {
                        try {
                          const dt = new Date(pagVenda.vencimento + 'T12:00:00')
                          if (!isNaN(dt.getTime())) {
                            if (pagVenda.prazo === 'diaria') dt.setDate(dt.getDate() + i)
                            else if (pagVenda.prazo === 'semanal') dt.setDate(dt.getDate() + i * 7)
                            else if (pagVenda.prazo === 'mensal') dt.setMonth(dt.getMonth() + i)
                            dtP = dt.toISOString().split('T')[0]
                          }
                        } catch (e) {
                          console.error('Erro data casada (venda):', e)
                        }
                      }
                      return (
                        <div key={i} className="flex justify-between items-center bg-white/95 px-3 py-1.5 rounded-lg border border-pink-100 shadow-sm transition-all hover:bg-white group">
                          <span className="text-[10px] font-black text-pink-300 group-hover:text-pink-600 uppercase italic leading-none">{i + 1}ª</span>
                          <span className="text-xs font-bold text-slate-600 leading-none">{dtP ? dtP.split('-').reverse().slice(0, 2).join('/') : '--/--'}</span>
                          <span className="text-xs font-black text-pink-800 leading-none">R$ {(i === pagVenda.parcelas - 1 ? valorUltima : valorBase).toFixed(2)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className={`bg-blue-50/10 p-3 rounded-lg border border-blue-100 space-y-3 ${idEntradaAnexar ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
              <div className="flex justify-between items-center border-b border-blue-100 pb-1.5">
                <h4 className="text-[11px] font-bold text-blue-700 uppercase">Pagamento Compra</h4>
                <div className="flex items-center gap-2">
                  <label className="text-[9px] font-bold text-blue-600 uppercase">Acresc./Desc.</label>
                  <input type="number" value={pagCompra.acrescimoDesconto} onChange={e => setPagCompra({...pagCompra, acrescimoDesconto: Number(e.target.value)})} className="w-16 border rounded px-1 py-0.5 text-[10px] bg-white" placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="flex flex-col"><label className="text-[10px] font-semibold text-blue-600 uppercase tracking-tighter">Status</label><select value={pagCompra.status} onChange={e => setPagCompra({...pagCompra, status: e.target.value})} className="border rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"><option value="pendente">Pendente</option><option value="pago">Pago</option></select></div>
                <div className="flex flex-col"><label className="text-[10px] font-semibold text-blue-600 uppercase tracking-tighter">Parc.</label><input type="number" value={pagCompra.parcelas} onChange={e => setPagCompra({...pagCompra, parcelas: Math.max(1, Number(e.target.value))})} className="border rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none" /></div>
                <div className="flex flex-col"><label className="text-[10px] font-semibold text-blue-600 uppercase tracking-tighter">Venc.</label><input type="date" value={pagCompra.vencimento} onChange={e => setPagCompra({...pagCompra, vencimento: e.target.value})} className="border rounded px-1 py-1 text-[10px] bg-white h-[28px] focus:ring-1 focus:ring-blue-500 outline-none" /></div>
                <div className="flex flex-col"><label className="text-[10px] font-semibold text-blue-600 uppercase tracking-tighter">Prazo</label><select value={pagCompra.prazo} onChange={e => setPagCompra({...pagCompra, prazo: e.target.value})} className="border rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"><option value="mensal">Mensal</option><option value="semanal">Semanal</option><option value="diaria">Diária</option></select></div>
              </div>

              {/* Preview Parcelas Compra */}
              {pagCompra.parcelas > 1 && (
                <div className="mt-2 bg-blue-50/30 p-2 rounded-lg border border-blue-100 max-h-32 overflow-y-auto shadow-inner custom-scrollbar">
                  <div className="grid grid-cols-2 gap-1.5">
                    {Array.from({ length: Math.min(pagCompra.parcelas, 48) }).map((_, i) => {
                      const valorBase = Math.floor(((totalCompra + pagCompra.acrescimoDesconto) / pagCompra.parcelas) * 100) / 100
                      const valorUltima = Number(((totalCompra + pagCompra.acrescimoDesconto) - (valorBase * (pagCompra.parcelas - 1))).toFixed(2))
                      let dtP = pagCompra.vencimento
                      if (i > 0 && pagCompra.vencimento) {
                        try {
                          const dt = new Date(pagCompra.vencimento + 'T12:00:00')
                          if (!isNaN(dt.getTime())) {
                            if (pagCompra.prazo === 'diaria') dt.setDate(dt.getDate() + i)
                            else if (pagCompra.prazo === 'semanal') dt.setDate(dt.getDate() + i * 7)
                            else if (pagCompra.prazo === 'mensal') dt.setMonth(dt.getMonth() + i)
                            dtP = dt.toISOString().split('T')[0]
                          }
                        } catch (e) {
                          console.error('Erro data casada (compra):', e)
                        }
                      }
                      return (
                        <div key={i} className="flex justify-between items-center bg-white/95 px-3 py-1.5 rounded-lg border border-blue-100 shadow-sm transition-all hover:bg-white group">
                          <span className="text-[10px] font-black text-blue-300 group-hover:text-blue-600 uppercase italic leading-none">{i + 1}ª</span>
                          <span className="text-xs font-bold text-slate-600 leading-none">{dtP ? dtP.split('-').reverse().slice(0, 2).join('/') : '--/--'}</span>
                          <span className="text-xs font-black text-blue-800 leading-none">R$ {(i === pagCompra.parcelas - 1 ? valorUltima : valorBase).toFixed(2)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900 p-4 rounded-lg text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-4 border-t border-pink-500 relative">
            <div className="absolute top-0 left-4 -translate-y-1/2 bg-slate-800 text-[8px] px-2 py-0.5 rounded text-slate-400 font-mono border border-slate-700">CORE ENGINE v5.4</div>
            <div className="flex gap-8 items-center">
              <div className="flex flex-col"><p className="text-[8px] uppercase font-bold text-pink-400">Venda { (totalSaidaAnterior > 0) ? '(Ant. + Novo)' : '' }</p><div className="flex items-center gap-2">{totalSaidaAnterior > 0 && <span className="text-[10px] text-slate-400 font-mono">R$ {totalSaidaAnterior.toFixed(2)} + </span>}<p className="text-base font-black font-mono">R$ {(totalSaidaAnterior + totalVenda).toFixed(2)}</p></div></div>
              <div className="flex flex-col border-l border-white/10 pl-8"><p className="text-[8px] uppercase font-bold text-blue-400">Compra { (totalEntradaAnterior > 0) ? '(Ant. + Novo)' : '' }</p><div className="flex items-center gap-2">{totalEntradaAnterior > 0 && <span className="text-[10px] text-slate-400 font-mono">R$ {totalEntradaAnterior.toFixed(2)} + </span>}<p className="text-base font-black font-mono">R$ {(totalEntradaAnterior + totalCompra).toFixed(2)}</p></div></div>
            </div>
            <div className="flex gap-4">
              <button onClick={handleCancelar} className="bg-slate-700 hover:bg-red-700 text-white px-8 py-2.5 rounded-lg font-bold transition-all uppercase text-[11px] shadow-lg active:scale-95 border border-slate-600">Cancelar</button>
              <button onClick={handleSubmit} disabled={loading || !cliente || !fornecedor} className="bg-green-600 hover:bg-green-500 text-white px-10 py-2.5 rounded-lg font-black transition-all shadow-lg active:scale-95 uppercase text-[11px] disabled:opacity-50">{loading ? 'PROCESSANDO...' : '💰 FINALIZAR CASADA'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
