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
    if (aberto) console.log('🚀 LUCIUS V4.9 - MODAL VENDA CASADA CARREGADO')
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
  const [pagVenda, setPagVenda] = useState({ status: 'pendente', parcelas: 1, vencimento: data, prazo: 'mensal' })
  const [pagCompra, setPagCompra] = useState({ status: 'pendente', parcelas: 1, vencimento: data, prazo: 'mensal' })

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
        setItens(draft.itens || [{ id: Date.now().toString(), id_produto: '', codigo: '', nome: '', quantidade: 1, preco_unitario: 0, valor_repasse: 0, preco_custo: 0 }])
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
      codigo: (produto as any).codigo || '',
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

    if (err.code === 'PGRST204' || err.code === '23505' || err.code === '23503') {
      return `ERRO DE SCHEMA OU VÍNCULO: ${err.message}. Detalhes: ${err.details || ''}.`
    }

    let mensagem = err.message || 'Erro interno'
    if (err.details) mensagem += ` (Detalhes: ${err.details})`
    if (err.code) mensagem += ` [Código: ${err.code}]`
    if (err.hint) mensagem += ` - Dica: ${err.hint}`

    return mensagem
  }

  if (!aberto) return null

  const criarFinanceiro = async (total: number, entidade: string, tipo: 'entrada' | 'saida', refNum: number, status: string, qtdParcelas: number, vencimento: string, prazo: string, parentIds: { id_venda?: string; id_compra?: string; id_condicional?: string; id_pedido?: string }, isPedido: boolean = false) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const valorBase = Math.floor((total / qtdParcelas) * 100) / 100
    const valorUltima = Number((total - (valorBase * (qtdParcelas - 1))).toFixed(2))

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

      const valorFinalParcela = i === qtdParcelas ? valorUltima : valorBase

      transacoes.push({
        user_id: user.id,
        numero_transacao: refNum,
        descricao: `${tipo === 'entrada' ? 'Venda' : 'Compra'} ${entidade} (${i}/${qtdParcelas})`,
        total: valorFinalParcela,
        tipo,
        data: prepararDataParaInsert(dataParcela),
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
      const match = venda.observacao.match(/Compra #(\d+)/)
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

  const resetForm = () => {
    setCliente('')
    setFornecedor('')
    setData(getDataAtualBrasil())
    setItens([{ id: Date.now().toString(), id_produto: '', codigo: '', nome: '', quantidade: 1, preco_unitario: 0, valor_repasse: 0, preco_custo: 0 }])
    setPagVenda({ status: 'pendente', parcelas: 1, vencimento: getDataAtualBrasil(), prazo: 'mensal' })
    setPagCompra({ status: 'pendente', parcelas: 1, vencimento: getDataAtualBrasil(), prazo: 'mensal' })
    setVendaAnexar(null)
    setCompraAnexar(null)
    setIdSaidaAnexar(null)
    setIdEntradaAnexar(null)
    setIdSaidaAnexarIsNovo(false)
    setIdEntradaAnexarIsNovo(false)
    setTotalSaidaAnterior(0)
    setTotalEntradaAnterior(0)
  }

  const handleSubmit = async () => {
    if (!cliente || !fornecedor) return alert('Informe Cliente e Fornecedor')
    const itensValidos = itens.filter(i => i.id_produto || (i.isNovoCadastro && i.nome))
    if (itensValidos.length === 0) return alert('Adicione pelo menos um item válido')

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      let numSaida = 0
      let numEntrada = 0

      if (vendaAnexar) {
        numSaida = vendaAnexar.numero_transacao
        numEntrada = compraAnexar?.numero_transacao || numSaida
      } else if (idSaidaAnexar) {
        const table = idSaidaAnexarIsNovo ? 'pedidos_loja' : 'transacoes_condicionais'
        const { data: p } = await supabase.from(table).select('numero_transacao').eq('id', idSaidaAnexar).single()
        numSaida = p?.numero_transacao || 0
        const { data: n, error: e } = await supabase.rpc('obter_proximo_numero_transacao')
        if (e) throw e
        numEntrada = n
      } else if (idEntradaAnexar) {
        const table = idEntradaAnexarIsNovo ? 'pedidos_loja' : 'transacoes_condicionais'
        const { data: p } = await supabase.from(table).select('numero_transacao').eq('id', idEntradaAnexar).single()
        numEntrada = p?.numero_transacao || 0
        const { data: n, error: e } = await supabase.rpc('obter_proximo_numero_transacao')
        if (e) throw e
        numSaida = n
      }

      if (numSaida === 0 && numEntrada === 0) {
        const { data: n1, error: e1 } = await supabase.rpc('obter_proximo_numero_transacao')
        if (e1) throw e1
        numSaida = n1
        const { data: n2, error: e2 } = await supabase.rpc('obter_proximo_numero_transacao')
        if (e2) throw e2
        numEntrada = n2
      }

      // LADO SAÍDA
      let idSaida = null

      if (tipoSaida === 'venda') {
        if (vendaAnexar) {
          idSaida = vendaAnexar.id
          const novoTotalVenda = (vendaAnexar.total || 0) + totalVenda
          await supabase.from('vendas').update({ total: novoTotalVenda, quantidade_itens: (vendaAnexar.quantidade_itens || 0) + itensValidos.length }).eq('id', idSaida)
          await supabase.from('transacoes_loja').delete().eq('id_venda', idSaida)
          await criarFinanceiro(novoTotalVenda, cliente, 'entrada', numSaida, pagVenda.status, pagVenda.parcelas, pagVenda.vencimento, pagVenda.prazo, { id_venda: idSaida }, false)
        } else {
          const { data: v, error: ev } = await supabase.from('vendas').insert({
            cliente, data_venda: prepararDataParaInsert(data), total: totalVenda, status_pagamento: pagVenda.status, user_id: user.id, numero_transacao: numSaida,
            observacao: `VENDA CASADA (Simultânea com Compra #${numEntrada})`, quantidade_parcelas: pagVenda.parcelas, prazoparcelas: pagVenda.prazo, quantidade_itens: itensValidos.length
          }).select().single()
          if (ev) throw ev
          idSaida = v.id
          await criarFinanceiro(totalVenda, cliente, 'entrada', numSaida, pagVenda.status, pagVenda.parcelas, pagVenda.vencimento, pagVenda.prazo, { id_venda: idSaida }, false)
        }
      } else {
        if (idSaidaAnexar) {
          idSaida = idSaidaAnexar
          const table = idSaidaAnexarIsNovo ? 'pedidos_loja' : 'transacoes_condicionais'
          const colTotal = idSaidaAnexarIsNovo ? 'total_geral' : 'total'
          const { data: pOld } = await supabase.from(table).select(colTotal).eq('id', idSaida).single()
          const novoTotalSaida = ((pOld as any)?.[colTotal] || 0) + totalVenda

          await supabase.from(table).update({
            [colTotal]: novoTotalSaida,
            [idSaidaAnexarIsNovo ? 'total_financeiro' : 'total']: novoTotalSaida,
            quantidade_parcelas: pagVenda.parcelas,
            prazoparcelas: pagVenda.prazo,
            data_vencimento: prepararDataParaInsert(pagVenda.vencimento)
          }).eq('id', idSaida)

          await supabase.from('transacoes_loja').delete().eq(idSaidaAnexarIsNovo ? 'id_pedido' : 'id_condicional', idSaida)
          await criarFinanceiro(novoTotalSaida, cliente, 'entrada', numSaida, 'pendente', pagVenda.parcelas, pagVenda.vencimento, pagVenda.prazo, { [idSaidaAnexarIsNovo ? 'id_pedido' : 'id_condicional']: idSaida }, true)
        } else {
          const { data: p, error: ep } = await supabase.from('pedidos_loja').insert({
            entidade: cliente, data_pedido: prepararDataParaInsert(data), tipo: 'venda', status: 'pendente', numero_transacao: numSaida, total_geral: totalVenda, total_financeiro: totalVenda,
            observacao: `VENDA CASADA (Simultânea com Compra #${numEntrada})`, user_id: user.id,
            quantidade_parcelas: pagVenda.parcelas, prazoparcelas: pagVenda.prazo, data_vencimento: prepararDataParaInsert(pagVenda.vencimento)
          }).select().single()
          if (ep) throw ep
          idSaida = p.id
          await criarFinanceiro(totalVenda, cliente, 'entrada', numSaida, 'pendente', pagVenda.parcelas, pagVenda.vencimento, pagVenda.prazo, { id_pedido: idSaida }, true)
        }
      }

      // LADO ENTRADA
      let idEntrada = null

      if (tipoEntrada === 'compra') {
        if (compraAnexar) {
          idEntrada = compraAnexar.id
          const novoTotalCompra = (compraAnexar.total || 0) + totalCompra
          await supabase.from('compras').update({ total: novoTotalCompra, quantidade_itens: (compraAnexar.quantidade_itens || 0) + itensValidos.length }).eq('id', idEntrada)
          await supabase.from('transacoes_loja').delete().eq('id_compra', idEntrada)
          await criarFinanceiro(novoTotalCompra, fornecedor, 'saida', numEntrada, pagCompra.status, pagCompra.parcelas, pagCompra.vencimento, pagCompra.prazo, { id_compra: idEntrada }, false)
        } else {
          const { data: c, error: ec } = await supabase.from('compras').insert({
            fornecedor, data_compra: prepararDataParaInsert(data), total: totalCompra, status_pagamento: pagCompra.status, user_id: user.id, numero_transacao: numEntrada,
            observacao: `VENDA CASADA (Simultânea com Venda #${numSaida})`, quantidade_parcelas: pagCompra.parcelas, prazoparcelas: pagCompra.prazo, quantidade_itens: itensValidos.length
          }).select().single()
          if (ec) throw ec
          idEntrada = c.id
          await criarFinanceiro(totalCompra, fornecedor, 'saida', numEntrada, pagCompra.status, pagCompra.parcelas, pagCompra.vencimento, pagCompra.prazo, { id_compra: idEntrada }, false)
        }
      } else {
        if (idEntradaAnexar) {
          idEntrada = idEntradaAnexar
          const table = idEntradaAnexarIsNovo ? 'pedidos_loja' : 'transacoes_condicionais'
          const colTotal = idEntradaAnexarIsNovo ? 'total_geral' : 'total'
          const { data: pOld } = await supabase.from(table).select(colTotal).eq('id', idEntrada).single()
          const novoTotalEntrada = ((pOld as any)?.[colTotal] || 0) + totalCompra

          await supabase.from(table).update({
            [colTotal]: novoTotalEntrada,
            [idEntradaAnexarIsNovo ? 'total_financeiro' : 'total']: novoTotalEntrada,
            quantidade_parcelas: pagCompra.parcelas,
            prazoparcelas: pagCompra.prazo,
            data_vencimento: prepararDataParaInsert(pagCompra.vencimento)
          }).eq('id', idEntrada)

          await supabase.from('transacoes_loja').delete().eq(idEntradaAnexarIsNovo ? 'id_pedido' : 'id_condicional', idEntrada)
          await criarFinanceiro(novoTotalEntrada, fornecedor, 'saida', numEntrada, 'pendente', pagCompra.parcelas, pagCompra.vencimento, pagCompra.prazo, { [idEntradaAnexarIsNovo ? 'id_pedido' : 'id_condicional']: idEntrada }, true)
        } else {
          const { data: p, error: ep } = await supabase.from('pedidos_loja').insert({
            entidade: fornecedor, data_pedido: prepararDataParaInsert(data), tipo: 'compra', status: 'pendente', numero_transacao: numEntrada, total_geral: totalCompra, total_financeiro: totalCompra,
            observacao: `VENDA CASADA (Simultânea com Venda #${numSaida})`, user_id: user.id,
            quantidade_parcelas: pagCompra.parcelas, prazoparcelas: pagCompra.prazo, data_vencimento: prepararDataParaInsert(pagCompra.vencimento)
          }).select().single()
          if (ep) throw ep
          idEntrada = p.id
          await criarFinanceiro(totalCompra, fornecedor, 'saida', numEntrada, 'pendente', pagCompra.parcelas, pagCompra.vencimento, pagCompra.prazo, { id_pedido: idEntrada }, true)
        }
      }

      for (const item of itensValidos) {
        let prodId = item.id_produto
        if (item.isNovoCadastro && !prodId) {
          const { data: nP, error: eNP } = await supabase.from('produtos').insert({
            descricao: (item.nome || '').toUpperCase(), categoria: item.categoria, preco_custo: item.preco_custo, valor_repasse: item.valor_repasse, preco_venda: item.preco_unitario, quantidade: 0, user_id: user.id
          }).select().single()
          if (eNP) throw eNP
          prodId = nP.id
        }

        if (tipoSaida === 'venda') {
           await supabase.from('itens_venda').insert({ venda_id: idSaida, produto_id: prodId, descricao: item.nome, quantidade: item.quantidade, preco_venda: item.preco_unitario, preco_custo: item.preco_custo, valor_repasse: item.valor_repasse, observacao: `Venda Casada #${numEntrada}` })
        } else {
           const tableItens = (idSaidaAnexarIsNovo || (!idSaidaAnexar && tipoSaida === 'pedido_venda')) ? 'itens_pedido_loja' : 'itens_condicionais'
           await supabase.from(tableItens).insert({ [tableItens === 'itens_pedido_loja' ? 'pedido_id' : 'transacao_id']: idSaida, produto_id: prodId, descricao: item.nome, quantidade: item.quantidade, preco_venda: item.preco_unitario, preco_custo: item.preco_custo, valor_repasse: item.valor_repasse, status: 'pendente', [tableItens === 'itens_pedido_loja' ? 'observacao_item' : 'observacao']: `Venda Casada #${numEntrada}` })
        }

        if (tipoEntrada === 'compra') {
           await supabase.from('itens_compra').insert({ compra_id: idEntrada, produto_id: prodId, descricao: item.nome, quantidade: item.quantidade, preco_custo: item.preco_custo, valor_repasse: item.valor_repasse, preco_venda: item.preco_unitario, observacao: `Venda Casada #${numSaida}` })
        } else {
           const tableItens = (idEntradaAnexarIsNovo || (!idEntradaAnexar && tipoEntrada === 'pedido_compra')) ? 'itens_pedido_loja' : 'itens_condicionais'
           await supabase.from(tableItens).insert({ [tableItens === 'itens_pedido_loja' ? 'pedido_id' : 'transacao_id']: idEntrada, produto_id: prodId, descricao: item.nome, quantidade: item.quantidade, preco_custo: item.preco_custo, valor_repasse: item.valor_repasse, preco_venda: item.preco_unitario, status: 'pendente', [tableItens === 'itens_pedido_loja' ? 'observacao_item' : 'observacao']: `Venda Casada #${numSaida}` })
        }

        if (prodId) {
          if (tipoSaida !== 'pedido_venda') {
            await supabase.rpc('atualizar_estoque', { produto_id_param: prodId, quantidade_param: -Math.round(item.quantidade) })
            await supabase.from('movimentacoes_estoque').insert({ produto_id: prodId, tipo: 'saida', quantidade: item.quantidade, observacao: `Venda Casada #${numSaida}` })
          }
          if (tipoEntrada !== 'pedido_compra') {
            await supabase.rpc('atualizar_estoque', { produto_id_param: prodId, quantidade_param: Math.round(item.quantidade) })
            await supabase.from('produtos').update({ preco_custo: item.preco_custo, valor_repasse: item.valor_repasse, preco_venda: item.preco_unitario, categoria: item.categoria, data_ultima_compra: prepararDataParaInsert(data) }).eq('id', prodId)
            await supabase.from('movimentacoes_estoque').insert({ produto_id: prodId, tipo: 'entrada', quantidade: item.quantidade, observacao: `Compra Casada #${numEntrada}` })
          }
        }
      }

      triggerRefresh()
      onSucesso()
      alert('✅ Venda Casada gerada com sucesso!')
      clearDraft('venda_casada')
      resetForm()
      onClose()
    } catch (error: any) {
      alert('Erro: ' + formatarErro(error))
    } finally {
      setLoading(false)
    }
  }

  const handleCancelar = () => {
    if (window.confirm('Deseja realmente cancelar?')) {
      clearDraft('venda_casada')
      resetForm()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center z-[50] p-2 sm:p-4 overflow-y-auto pt-4 pb-20">
      <div className="bg-white w-full max-w-6xl rounded-xl shadow-xl flex flex-col h-fit my-auto overflow-visible min-h-[600px]">
        {/* Header */}
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
                {!vendaAnexar && !idSaidaAnexar && !idEntradaAnexar && (
                  <button
                    onClick={buscarCasadas}
                    className="bg-purple-600 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase shadow-sm hover:bg-purple-500"
                  >
                    Venda Casada Existente ➕
                  </button>
                )}
             </div>
             {(vendaAnexar || idSaidaAnexar || idEntradaAnexar) && (
               <button
                 onClick={resetForm}
                 className="text-[10px] font-bold text-red-600 hover:underline"
               >
                 CANCELAR ANEXO
               </button>
             )}
          </div>

          {mostrarBuscaCasada && !vendaAnexar && (
            <div className="bg-purple-50 border border-purple-200 p-2 rounded space-y-2 shadow-inner">
               <p className="font-bold text-purple-800 text-[10px] uppercase text-center">Selecione o PAR de Venda/Compra para adicionar itens:</p>
               <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
                 {casadasAbertas.map(v => (
                   <button
                     key={v.id}
                     onClick={() => selecionarCasadaParaAnexar(v)}
                     className="flex justify-between items-center p-2 bg-white border border-purple-100 hover:bg-purple-100 text-left rounded shadow-sm"
                   >
                     <div>
                       <p className="font-bold text-gray-700 text-xs">#{v.numero_transacao} - {v.cliente}</p>
                       <p className="text-[10px] text-gray-500 truncate italic">{v.observacao}</p>
                     </div>
                     <span className="text-[10px] font-mono bg-purple-200 px-2 py-0.5 rounded text-purple-700">Escolher</span>
                   </button>
                 ))}
               </div>
            </div>
          )}

          {!vendaAnexar && (
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-2 rounded border border-slate-200 shadow-sm">
               <div className="space-y-2">
                 <label className="text-[10px] font-bold text-slate-600 uppercase">1. Tipo de Saída</label>
                 <div className="flex gap-2">
                    <button
                      onClick={() => { setTipoSaida('venda'); setIdSaidaAnexar(null); }}
                      className={`flex-1 py-1 text-[10px] font-bold rounded border transition-all ${tipoSaida === 'venda' ? 'bg-green-600 text-white border-green-700 shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}
                    >
                      💰 VENDA
                    </button>
                    <button
                      onClick={() => setTipoSaida('pedido_venda')}
                      className={`flex-1 py-1 text-[10px] font-bold rounded border transition-all ${tipoSaida === 'pedido_venda' ? 'bg-yellow-500 text-slate-900 border-yellow-600 shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}
                    >
                      📝 PEDIDO VENDA
                    </button>
                 </div>
                 {tipoSaida === 'pedido_venda' && (
                    <div className="flex gap-2 items-center">
                       <button
                        onClick={() => buscarPedidos('enviado')}
                        className={`flex-1 py-1 text-[9px] font-black rounded border-2 dashed ${idSaidaAnexar ? 'bg-orange-50 border-orange-400 text-orange-700' : 'bg-white border-yellow-400 text-yellow-700'} uppercase`}
                       >
                         {idSaidaAnexar ? '📍 Pedido Saída Selecionado' : '➕ Anexar a Pedido Venda exist.'}
                       </button>
                       {idSaidaAnexar && <button onClick={() => setIdSaidaAnexar(null)} className="text-red-500 text-[10px]">✕</button>}
                    </div>
                 )}
               </div>

               <div className="space-y-2">
                 <label className="text-[10px] font-bold text-slate-600 uppercase">2. Tipo de Entrada</label>
                 <div className="flex gap-2">
                    <button
                      onClick={() => { setTipoEntrada('compra'); setIdEntradaAnexar(null); }}
                      className={`flex-1 py-1 text-[10px] font-bold rounded border transition-all ${tipoEntrada === 'compra' ? 'bg-blue-600 text-white border-blue-700 shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}
                    >
                      📥 COMPRA
                    </button>
                    <button
                      onClick={() => setTipoEntrada('pedido_compra')}
                      className={`flex-1 py-1 text-[10px] font-bold rounded border transition-all ${tipoEntrada === 'pedido_compra' ? 'bg-orange-500 text-white border-orange-600 shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}
                    >
                      📦 PEDIDO COMPRA
                    </button>
                 </div>
                 {tipoEntrada === 'pedido_compra' && (
                    <div className="flex gap-2 items-center">
                       <button
                        onClick={() => buscarPedidos('recebido')}
                        className={`flex-1 py-1 text-[9px] font-black rounded border-2 dashed ${idEntradaAnexar ? 'bg-orange-50 border-orange-400 text-orange-700' : 'bg-white border-orange-400 text-orange-700'} uppercase`}
                       >
                         {idEntradaAnexar ? '📍 Pedido Entrada Selecionado' : '➕ Anexar a Pedido Compra exist.'}
                       </button>
                       {idEntradaAnexar && <button onClick={() => setIdEntradaAnexar(null)} className="text-red-500 text-[10px]">✕</button>}
                    </div>
                 )}
               </div>
            </div>
          )}

          {mostrarBuscaSaida && (
            <div className="bg-yellow-50 border border-yellow-200 p-2 rounded space-y-2 shadow-sm">
               <p className="font-bold text-yellow-800 text-[10px] uppercase">Selecione o PEDIDO DE VENDA para anexar:</p>
               <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
                  {pedidosSaidaAbertos.map(p => (
                    <button
                      key={p.id}
                      onClick={() => selecionarPedidoLado(p, 'saida')}
                      className="flex justify-between items-center p-2 bg-white border border-yellow-200 hover:bg-yellow-100 text-left rounded"
                    >
                      <div><p className="font-bold text-xs">#{p.numero_transacao} - {p.origem || p.entidade}</p><p className="text-[9px] truncate italic">{p.observacao}</p></div>
                      <span className="text-[10px] bg-yellow-200 px-1 rounded">Vincular</span>
                    </button>
                  ))}
               </div>
            </div>
          )}

          {mostrarBuscaEntrada && (
            <div className="bg-orange-50 border border-orange-200 p-2 rounded space-y-2 shadow-sm">
               <p className="font-bold text-orange-800 text-[10px] uppercase">Selecione o PEDIDO DE COMPRA para anexar:</p>
               <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
                  {pedidosEntradaAbertos.map(p => (
                    <button
                      key={p.id}
                      onClick={() => selecionarPedidoLado(p, 'entrada')}
                      className="flex justify-between items-center p-2 bg-white border border-orange-200 hover:bg-orange-100 text-left rounded"
                    >
                      <div><p className="font-bold text-xs">#{p.numero_transacao} - {p.origem || p.entidade}</p><p className="text-[9px] truncate italic">{p.observacao}</p></div>
                      <span className="text-[10px] bg-orange-200 px-1 rounded text-orange-700">Vincular</span>
                    </button>
                  ))}
               </div>
            </div>
          )}

          <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 ${ (vendaAnexar || idSaidaAnexar || idEntradaAnexar) ? 'bg-slate-50 p-1 rounded border border-slate-100' : ''}`}>
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold text-pink-600 uppercase mb-0.5 ml-1 flex items-center gap-1">
                <ShoppingBag size={10} /> Cliente
              </label>
              <SeletorEntidade valor={cliente} onChange={setCliente} tipo="cliente" placeholder="Nome do cliente..." disabled={!!vendaAnexar || !!idSaidaAnexar} />
            </div>
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold text-blue-600 uppercase mb-0.5 ml-1 flex items-center gap-1">
                <Truck size={10} /> Fornecedor
              </label>
              <SeletorEntidade valor={fornecedor} onChange={setFornecedor} tipo="fornecedor" placeholder="Nome do fornecedor..." disabled={!!compraAnexar || !!idEntradaAnexar} />
            </div>
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold text-slate-500 uppercase mb-0.5 ml-1">Data</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} className="w-full border rounded px-2 py-1 text-xs h-[32px]" />
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg shadow-sm bg-white overflow-visible">
            <div className="bg-slate-50 px-3 py-1.5 flex justify-between items-center border-b border-slate-200">
              <h3 className="text-[11px] font-semibold text-slate-700 uppercase tracking-widest">Produtos Vinculados</h3>
              <button onClick={adicionarItem} className="bg-slate-900 text-white px-3 py-1 rounded text-[10px] font-semibold hover:bg-slate-800 transition-colors uppercase tracking-tight">
                + ADICIONAR ITEM
              </button>
            </div>

            <div className="w-full p-2 space-y-2">
              {itens.map((item, idx) => (
                <div key={item.id} className={`border rounded p-2 transition-colors ${item.minimizado ? 'bg-slate-50 border-slate-200' : 'bg-pink-50/10 border-pink-200 shadow-inner'}`}>
                  {item.minimizado ? (
                    <div className="flex justify-between items-center cursor-pointer" onClick={() => atualizarItem(item.id, 'minimizado', false)}>
                       <span className="text-[11px] font-semibold text-slate-700 uppercase">
                         {idx + 1}. {item.nome || '(Busque um produto)'} - {item.quantidade}x (V: R${item.preco_unitario.toFixed(2)} | C: R${item.valor_repasse.toFixed(2)})
                       </span>
                       <div className="flex gap-2">
                          <button onClick={(e) => { e.stopPropagation(); atualizarItem(item.id, 'minimizado', false); }} className="text-blue-600 text-[10px] font-bold">EDITAR</button>
                          <button onClick={(e) => { e.stopPropagation(); removerItem(item.id); }} className="text-red-600 text-[10px] font-bold">REMOVER</button>
                       </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                       <div className="flex justify-between items-center">
                          <span className="text-[11px] font-black text-pink-700 uppercase">Item {idx + 1}</span>
                          <label className="flex items-center gap-1.5 cursor-pointer bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">
                            <input type="checkbox" checked={item.isNovoCadastro || false} onChange={() => toggleNovoCadastro(item.id)} className="w-3.5 h-3.5 accent-pink-600" />
                            <span className="text-[10px] font-bold text-slate-600 uppercase">Novo Cadastro</span>
                          </label>
                       </div>
                       {!item.isNovoCadastro ? (
                         <SeletorProduto key={`sel-casada-${resetSeletorKey}-${item.id}`} onSelecionarProduto={(p) => selecionarProduto(p, item.id)} placeholder="Buscar produto..." descricaoPreenchida={item.nome || ''} />
                       ) : (
                         <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                               <div className="col-span-1"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Código (Auto)</label><input type="text" value={item.codigo || ''} onChange={(e) => atualizarItem(item.id, 'codigo', e.target.value)} className="w-full px-2 py-1.5 text-xs border rounded font-mono" /></div>
                               <div className="col-span-2"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descrição *</label><input type="text" value={item.nome || ''} onChange={(e) => atualizarItem(item.id, 'nome', e.target.value)} className="w-full px-2 py-1.5 text-xs border rounded" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                               <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Categoria *</label><select value={item.categoria || ''} onChange={(e) => atualizarItem(item.id, 'categoria', e.target.value)} className="w-full px-2 py-1 text-xs border rounded bg-white">{categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}</select></div>
                               <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qtd *</label><input type="number" value={item.quantidade} onChange={(e) => atualizarItem(item.id, 'quantidade', Number(e.target.value))} className="w-full px-2 py-1 text-xs border rounded" /></div>
                            </div>
                         </div>
                       )}
                       <div className="grid grid-cols-3 gap-2">
                          <div><label className="block text-[10px] font-bold text-red-600 uppercase mb-1">Preço Custo *</label><input type="number" step="0.01" value={item.preco_custo} onChange={(e) => atualizarItem(item.id, 'preco_custo', Number(e.target.value))} className="w-full px-2 py-1 text-xs border border-red-200 rounded" /></div>
                          <div><label className="block text-[10px] font-bold text-orange-600 uppercase mb-1">Valor Repasse</label><input type="number" step="0.01" value={item.valor_repasse} onChange={(e) => atualizarItem(item.id, 'valor_repasse', Number(e.target.value))} className="w-full px-2 py-1 text-xs border border-orange-200 rounded" /></div>
                          <div><label className="block text-[10px] font-bold text-green-600 uppercase mb-1">Preço Venda *</label><input type="number" step="0.01" value={item.preco_unitario} onChange={(e) => atualizarItem(item.id, 'preco_unitario', Number(e.target.value))} className="w-full px-2 py-1 text-xs border border-green-200 rounded" /></div>
                       </div>
                       <div className="flex justify-end gap-2 pt-1 border-t border-pink-100">
                          <button onClick={() => atualizarItem(item.id, 'minimizado', true)} className="text-[10px] font-bold text-slate-400 uppercase">Minimizar</button>
                          <button onClick={() => removerItem(item.id)} className="text-[10px] font-bold text-red-400 uppercase">Remover</button>
                       </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${(vendaAnexar || (idSaidaAnexar && idEntradaAnexar)) ? 'hidden' : ''}`}>
            {/* Pagamento Venda */}
            <div className={`bg-pink-50/10 p-3 rounded-lg border border-pink-100 space-y-3 ${(idSaidaAnexar && !vendaAnexar) ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
              <div className="flex justify-between items-center border-b border-pink-100 pb-1.5">
                <h4 className="text-[11px] font-semibold text-pink-700 uppercase tracking-widest">Pagamento Venda</h4>
                <div className="flex flex-col items-end">
                   {totalSaidaAnterior > 0 && <span className="text-[9px] text-slate-500 line-through">R$ {totalSaidaAnterior.toFixed(2)}</span>}
                   <span className="text-sm font-semibold text-pink-700">R$ {(totalSaidaAnterior + totalVenda).toFixed(2)}</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="flex flex-col"><label className="text-[10px] font-semibold text-pink-600 uppercase">Status</label><select value={pagVenda.status} onChange={e => setPagVenda({...pagVenda, status: e.target.value})} className="border rounded px-2 py-1 text-xs"><option value="pendente">Pendente</option><option value="pago">Pago</option></select></div>
                <div className="flex flex-col"><label className="text-[10px] font-semibold text-pink-600 uppercase">Parc.</label><input type="number" value={pagVenda.parcelas} onChange={e => setPagVenda({...pagVenda, parcelas: Math.max(1, Number(e.target.value))})} className="border rounded px-2 py-1 text-xs" /></div>
                <div className="flex flex-col"><label className="text-[10px] font-semibold text-pink-600 uppercase">Vencimento</label><input type="date" value={pagVenda.vencimento} onChange={e => setPagVenda({...pagVenda, vencimento: e.target.value})} className="border rounded px-1 py-1 text-[10px]" /></div>
                <div className="flex flex-col"><label className="text-[10px] font-semibold text-pink-600 uppercase">Prazo</label><select value={pagVenda.prazo} onChange={e => setPagVenda({...pagVenda, prazo: e.target.value})} className="border rounded px-2 py-1 text-xs"><option value="mensal">Mensal</option><option value="semanal">Semanal</option><option value="diaria">Diária</option></select></div>
              </div>
            </div>
            {/* Pagamento Compra */}
            <div className={`bg-blue-50/10 p-3 rounded-lg border border-blue-100 space-y-3 ${(idEntradaAnexar && !compraAnexar) ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
              <div className="flex justify-between items-center border-b border-blue-100 pb-1.5">
                <h4 className="text-[11px] font-semibold text-blue-700 uppercase tracking-widest">Pagamento Compra</h4>
                <div className="flex flex-col items-end">
                   {totalEntradaAnterior > 0 && <span className="text-[9px] text-slate-500 line-through">R$ {totalEntradaAnterior.toFixed(2)}</span>}
                   <span className="text-sm font-semibold text-blue-700">R$ {(totalEntradaAnterior + totalCompra).toFixed(2)}</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="flex flex-col"><label className="text-[10px] font-semibold text-blue-600 uppercase">Status</label><select value={pagCompra.status} onChange={e => setPagCompra({...pagCompra, status: e.target.value})} className="border rounded px-2 py-1 text-xs"><option value="pendente">Pendente</option><option value="pago">Pago</option></select></div>
                <div className="flex flex-col"><label className="text-[10px] font-semibold text-blue-600 uppercase">Parc.</label><input type="number" value={pagCompra.parcelas} onChange={e => setPagCompra({...pagCompra, parcelas: Math.max(1, Number(e.target.value))})} className="border rounded px-2 py-1 text-xs" /></div>
                <div className="flex flex-col"><label className="text-[10px] font-semibold text-blue-600 uppercase">Vencimento</label><input type="date" value={pagCompra.vencimento} onChange={e => setPagCompra({...pagCompra, vencimento: e.target.value})} className="border rounded px-1 py-1 text-[10px]" /></div>
                <div className="flex flex-col"><label className="text-[10px] font-semibold text-blue-600 uppercase">Prazo</label><select value={pagCompra.prazo} onChange={e => setPagCompra({...pagCompra, prazo: e.target.value})} className="border rounded px-2 py-1 text-xs"><option value="mensal">Mensal</option><option value="semanal">Semanal</option><option value="diaria">Diária</option></select></div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-3 rounded-lg text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-2 border-t border-pink-500 relative">
            <div className="absolute top-0 left-4 -translate-y-1/2 bg-slate-800 text-[8px] px-2 py-0.5 rounded text-slate-400 font-mono border border-slate-700">CORE ENGINE v4.9</div>
            <div className="flex gap-4 items-center">
              <div><p className="text-[8px] uppercase font-semibold text-pink-400">Total Venda</p><p className="text-sm font-mono">R$ {(totalSaidaAnterior + totalVenda).toFixed(2)}</p></div>
              <div><p className="text-[8px] uppercase font-semibold text-blue-400">Total Compra</p><p className="text-sm font-mono">R$ {(totalEntradaAnterior + totalCompra).toFixed(2)}</p></div>
              <div><p className="text-[8px] uppercase font-semibold text-green-400">Diferença</p><p className="text-sm font-mono text-green-400">R$ {diferenca.toFixed(2)}</p></div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCancelar} className="bg-slate-700 hover:bg-red-700 text-white px-8 py-2 rounded font-bold uppercase text-[10px]">Cancelar</button>
              <button onClick={handleSubmit} disabled={loading} className="bg-green-600 hover:bg-green-500 text-white px-10 py-2 rounded font-black uppercase text-[10px]">{loading ? '...' : '💰 Finalizar'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
