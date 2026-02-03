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
    if (aberto) console.log('🚀 LUCIUS V3.7 - MODAL VENDA CASADA CARREGADO')
  }, [aberto])

  const { recarregarDados } = useDadosFinanceiros()
  const { getDraft, setDraft, clearDraft } = useFormDraft()
  const [loading, setLoading] = useState(false)

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
  const [totalSaidaAnterior, setTotalSaidaAnterior] = useState(0)
  const [totalEntradaAnterior, setTotalEntradaAnterior] = useState(0)

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
      return `ERRO CRÍTICO DE SCHEMA: ${err.message}. Detalhes: ${err.details || ''}. POR FAVOR, EXECUTE O SCRIPT SQL V3.5 NO SEU SUPABASE (SQL EDITOR).`
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

  const criarFinanceiro = async (total: number, entidade: string, tipo: 'entrada' | 'saida', refNum: number, status: string, qtdParcelas: number, vencimento: string, prazo: string, parentIds: { id_venda?: string; id_compra?: string; id_condicional?: string }, isPedido: boolean = false) => {
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
      transacoes.push({
        user_id: user.id,
        numero_transacao: refNum,
        descricao: `${tipo === 'entrada' ? 'Venda' : 'Compra'} Casada - ${entidade} (${i}/${qtdParcelas})`,
        total: valorParcela,
        tipo,
        data: prepararDataParaInsert(dataParcela),
        status_pagamento: i === 1 && total > 0 ? status : 'pendente',
        observacao: isPedido ? `[PEDIDO] Ref. #${refNum}` : `Ref. #${refNum}`,
        ...parentIds
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
      setTotalSaidaAnterior(venda.total || 0)
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
      const { data: pds, error } = await supabase
        .from('transacoes_condicionais')
        .select('*')
        .eq('tipo', tipoLado)
        .eq('status', 'pendente')
        .ilike('observacao', '%[PEDIDO]%')
        .order('data_transacao', { ascending: false })

      if (error) throw error
      if (tipoLado === 'enviado') {
        setPedidosSaidaAbertos(pds || [])
        setMostrarBuscaSaida(true)
      } else {
        setPedidosEntradaAbertos(pds || [])
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
      setTotalSaidaAnterior(pedido.total || 0)
      setCliente(pedido.origem)
      setData(pedido.data_transacao.split('T')[0])
      if (pedido.quantidade_parcelas) setPagVenda(prev => ({ ...prev, parcelas: pedido.quantidade_parcelas }))
      if (pedido.prazoparcelas) setPagVenda(prev => ({ ...prev, prazo: pedido.prazoparcelas }))
      if (pedido.data_vencimento) setPagVenda(prev => ({ ...prev, vencimento: pedido.data_vencimento.split('T')[0] }))
      setMostrarBuscaSaida(false)
    } else {
      setIdEntradaAnexar(pedido.id)
      setTotalEntradaAnterior(pedido.total || 0)
      setFornecedor(pedido.origem)
      setData(pedido.data_transacao.split('T')[0])
      if (pedido.quantidade_parcelas) setPagCompra(prev => ({ ...prev, parcelas: pedido.quantidade_parcelas }))
      if (pedido.prazoparcelas) setPagCompra(prev => ({ ...prev, prazo: pedido.prazoparcelas }))
      if (pedido.data_vencimento) setPagCompra(prev => ({ ...prev, vencimento: pedido.data_vencimento.split('T')[0] }))
      setMostrarBuscaEntrada(false)
    }
  }

  const handleSubmit = async () => {
    if (!cliente || !fornecedor) return alert('Informe Cliente e Fornecedor')
    const itensValidos = itens.filter(i => i.id_produto)
    if (itensValidos.length === 0) return alert('Adicione pelo menos um item válido')

    setLoading(true)
    try {
      console.log('DEBUG: Iniciando processamento de Venda Casada V3.7:', { cliente, fornecedor, totalVenda, totalCompra, tipoSaida, tipoEntrada })
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      // LADO SAÍDA
      let idSaida = null
      let numSaida = 0

      if (tipoSaida === 'venda') {
        if (vendaAnexar) {
          idSaida = vendaAnexar.id
          numSaida = vendaAnexar.numero_transacao
          const novoTotalVenda = (vendaAnexar.total || 0) + totalVenda
          const novaQtdVenda = (vendaAnexar.quantidade_itens || 0) + itensValidos.length
          await supabase.from('vendas').update({
            total: novoTotalVenda,
            quantidade_itens: novaQtdVenda
          }).eq('id', idSaida)

          // Recalcular Financeiro
          await supabase.from('transacoes_loja').delete().eq('id_venda', idSaida)
          await supabase.from('transacoes_loja').delete().eq('numero_transacao', numSaida).ilike('descricao', `%${cliente}%`)
          await criarFinanceiro(novoTotalVenda, cliente, 'entrada', numSaida, pagVenda.status, pagVenda.parcelas, pagVenda.vencimento, pagVenda.prazo, { id_venda: idSaida }, false)
        } else {
          const { data: n, error: e } = await supabase.rpc('obter_proximo_numero_transacao')
          if (e) throw e
          numSaida = n
          const { data: v, error: ev } = await supabase.from('vendas').insert({
            cliente,
            data_venda: prepararDataParaInsert(data),
            total: totalVenda,
            status_pagamento: pagVenda.status,
            user_id: user.id,
            numero_transacao: numSaida,
            observacao: `VENDA CASADA (Saída: VENDA)`,
            quantidade_parcelas: pagVenda.parcelas,
            prazoparcelas: pagVenda.prazo,
            quantidade_itens: itensValidos.length
          }).select().single()
          if (ev) throw ev
          idSaida = v.id
          await criarFinanceiro(totalVenda, cliente, 'entrada', numSaida, pagVenda.status, pagVenda.parcelas, pagVenda.vencimento, pagVenda.prazo, { id_venda: idSaida }, false)
        }
      } else {
        // Pedido Venda
        if (idSaidaAnexar) {
          idSaida = idSaidaAnexar
          const { data: pOld } = await supabase.from('transacoes_condicionais').select('total, numero_transacao').eq('id', idSaida).single()
          numSaida = pOld?.numero_transacao || 0
          const novoTotalSaida = (pOld?.total || 0) + totalVenda
          await supabase.from('transacoes_condicionais').update({ total: novoTotalSaida }).eq('id', idSaida)

          // Recalcular Financeiro Pedido
          await supabase.from('transacoes_loja').delete().eq('id_condicional', idSaida)
          await supabase.from('transacoes_loja').delete().eq('numero_transacao', numSaida).ilike('descricao', `%${cliente}%`)
          await criarFinanceiro(novoTotalSaida, cliente, 'entrada', numSaida, 'pendente', pagVenda.parcelas, pagVenda.vencimento, pagVenda.prazo, { id_condicional: idSaida }, true)

          await supabase.from('transacoes_condicionais').update({
            total: novoTotalSaida,
            quantidade_parcelas: pagVenda.parcelas,
            prazoparcelas: pagVenda.prazo,
            data_vencimento: prepararDataParaInsert(pagVenda.vencimento)
          }).eq('id', idSaida)
        } else {
          const { data: n, error: e } = await supabase.rpc('obter_proximo_numero_transacao')
          if (e) throw e
          numSaida = n
          const { data: p, error: ep } = await supabase.from('transacoes_condicionais').insert({
            origem: cliente, data_transacao: prepararDataParaInsert(data), tipo: 'enviado', status: 'pendente', numero_transacao: numSaida, total: totalVenda,
            observacao: `[PEDIDO] VENDA CASADA (Saída: PEDIDO)`,
            quantidade_parcelas: pagVenda.parcelas,
            prazoparcelas: pagVenda.prazo,
            data_vencimento: prepararDataParaInsert(pagVenda.vencimento)
          }).select().single()
          if (ep) throw ep
          idSaida = p.id
          await criarFinanceiro(totalVenda, cliente, 'entrada', numSaida, 'pendente', pagVenda.parcelas, pagVenda.vencimento, pagVenda.prazo, { id_condicional: idSaida }, true)
        }
      }

      // LADO ENTRADA
      let idEntrada = null
      let numEntrada = 0

      if (tipoEntrada === 'compra') {
        if (compraAnexar) {
          idEntrada = compraAnexar.id
          numEntrada = compraAnexar.numero_transacao
          const novoTotalCompra = (compraAnexar.total || 0) + totalCompra
          const novaQtdCompra = (compraAnexar.quantidade_itens || 0) + itensValidos.length
          await supabase.from('compras').update({
            total: novoTotalCompra,
            quantidade_itens: novaQtdCompra
          }).eq('id', idEntrada)

          // Recalcular Financeiro
          await supabase.from('transacoes_loja').delete().eq('id_compra', idEntrada)
          await supabase.from('transacoes_loja').delete().eq('numero_transacao', numEntrada).ilike('descricao', `%${fornecedor}%`)
          await criarFinanceiro(novoTotalCompra, fornecedor, 'saida', numEntrada, pagCompra.status, pagCompra.parcelas, pagCompra.vencimento, pagCompra.prazo, { id_compra: idEntrada }, false)
        } else {
          const { data: n, error: e } = await supabase.rpc('obter_proximo_numero_transacao')
          if (e) throw e
          numEntrada = n
          const { data: c, error: ec } = await supabase.from('compras').insert({
            fornecedor,
            data_compra: prepararDataParaInsert(data),
            total: totalCompra,
            status_pagamento: pagCompra.status,
            user_id: user.id,
            numero_transacao: numEntrada,
            observacao: `VENDA CASADA (Entrada: COMPRA)`,
            quantidade_parcelas: pagCompra.parcelas,
            prazoparcelas: pagCompra.prazo,
            quantidade_itens: itensValidos.length
          }).select().single()
          if (ec) throw ec
          idEntrada = c.id
          await criarFinanceiro(totalCompra, fornecedor, 'saida', numEntrada, pagCompra.status, pagCompra.parcelas, pagCompra.vencimento, pagCompra.prazo, { id_compra: idEntrada }, false)
        }
      } else {
        // Pedido Compra
        if (idEntradaAnexar) {
          idEntrada = idEntradaAnexar
          const { data: pOld } = await supabase.from('transacoes_condicionais').select('total, numero_transacao').eq('id', idEntrada).single()
          numEntrada = pOld?.numero_transacao || 0
          const novoTotalEntrada = (pOld?.total || 0) + totalCompra
          await supabase.from('transacoes_condicionais').update({ total: novoTotalEntrada }).eq('id', idEntrada)

          // Recalcular Financeiro Pedido
          await supabase.from('transacoes_loja').delete().eq('id_condicional', idEntrada)
          await supabase.from('transacoes_loja').delete().eq('numero_transacao', numEntrada).ilike('descricao', `%${fornecedor}%`)
          await criarFinanceiro(novoTotalEntrada, fornecedor, 'saida', numEntrada, 'pendente', pagCompra.parcelas, pagCompra.vencimento, pagCompra.prazo, { id_condicional: idEntrada }, true)

          await supabase.from('transacoes_condicionais').update({
            total: novoTotalEntrada,
            quantidade_parcelas: pagCompra.parcelas,
            prazoparcelas: pagCompra.prazo,
            data_vencimento: prepararDataParaInsert(pagCompra.vencimento)
          }).eq('id', idEntrada)
        } else {
          const { data: n, error: e } = await supabase.rpc('obter_proximo_numero_transacao')
          if (e) throw e
          numEntrada = n
          const { data: p, error: ep } = await supabase.from('transacoes_condicionais').insert({
            origem: fornecedor, data_transacao: prepararDataParaInsert(data), tipo: 'recebido', status: 'pendente', numero_transacao: numEntrada, total: totalCompra,
            observacao: `[PEDIDO] VENDA CASADA (Entrada: PEDIDO)`,
            quantidade_parcelas: pagCompra.parcelas,
            prazoparcelas: pagCompra.prazo,
            data_vencimento: prepararDataParaInsert(pagCompra.vencimento)
          }).select().single()
          if (ep) throw ep
          idEntrada = p.id
          await criarFinanceiro(totalCompra, fornecedor, 'saida', numEntrada, 'pendente', pagCompra.parcelas, pagCompra.vencimento, pagCompra.prazo, { id_condicional: idEntrada }, true)
        }
      }

      // 3. Processar Itens
      for (const item of itensValidos) {
        // Gravar no lado da saída
        if (tipoSaida === 'venda') {
           await supabase.from('itens_venda').insert({ venda_id: idSaida, produto_id: item.id_produto, descricao: item.nome, quantidade: item.quantidade, preco_venda: item.preco_unitario, preco_custo: item.preco_custo, valor_repasse: item.valor_repasse })
        } else {
           await supabase.from('itens_condicionais').insert({ transacao_id: idSaida, produto_id: item.id_produto, descricao: item.nome, quantidade: item.quantidade, preco_venda: item.preco_unitario, preco_custo: item.preco_custo, valor_repasse: item.valor_repasse, status: 'pendente' })
        }

        // Gravar no lado da entrada
        if (tipoEntrada === 'compra') {
           await supabase.from('itens_compra').insert({ compra_id: idEntrada, produto_id: item.id_produto, descricao: item.nome, quantidade: item.quantidade, preco_custo: item.preco_custo, valor_repasse: item.valor_repasse, preco_venda: item.preco_unitario })
        } else {
           await supabase.from('itens_condicionais').insert({ transacao_id: idEntrada, produto_id: item.id_produto, descricao: item.nome, quantidade: item.quantidade, preco_custo: item.preco_custo, valor_repasse: item.valor_repasse, preco_venda: item.preco_unitario, status: 'pendente' })
        }

        // Movimentação de Estoque (Impactar ambos os lados para rastreabilidade)

        // Saída (Venda ou Pedido)
        console.log(`📦 DEBUG ESTOQUE CASADA: Atualizando (Saída) Produto ${item.id_produto}, Qtd: -${item.quantidade}`)
        const { error: errorRPCOut } = await supabase.rpc('atualizar_estoque', { produto_id_param: item.id_produto, quantidade_param: -item.quantidade })
        if (errorRPCOut) console.error('📦 ERRO RPC ESTOQUE (Casada Saída):', errorRPCOut)

        await supabase.from('movimentacoes_estoque').insert({
            produto_id: item.id_produto,
            tipo: 'saida',
            quantidade: item.quantidade,
            observacao: `Venda Casada #${numSaida}`
        })

        // Entrada (Compra ou Pedido)
        console.log(`📦 DEBUG ESTOQUE CASADA: Atualizando (Entrada) Produto ${item.id_produto}, Qtd: ${item.quantidade}`)
        const { error: errorRPCIn } = await supabase.rpc('atualizar_estoque', { produto_id_param: item.id_produto, quantidade_param: item.quantidade })
        if (errorRPCIn) console.error('📦 ERRO RPC ESTOQUE (Casada Entrada):', errorRPCIn)

        await supabase.from('movimentacoes_estoque').insert({
            produto_id: item.id_produto,
            tipo: 'entrada',
            quantidade: item.quantidade,
            observacao: `Compra Casada #${numEntrada}`
        })
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
      setVendaAnexar(null)
      setCompraAnexar(null)
      setIdSaidaAnexar(null)
      setIdEntradaAnexar(null)
      setTotalSaidaAnterior(0)
      setTotalEntradaAnterior(0)
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
                {!vendaAnexar && !idSaidaAnexar && !idEntradaAnexar && (
                  <button
                    onClick={buscarCasadas}
                    className="bg-purple-600 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase shadow-sm hover:bg-purple-500"
                  >
                    Venda Casada Existente ➕
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
               <button onClick={() => setMostrarBuscaCasada(false)} className="text-[10px] text-slate-500 hover:underline w-full text-center">Fechar busca</button>
            </div>
          )}

          {/* Seleção de Tipos - NOVO V3.7 */}
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
                      <div><p className="font-bold text-xs">#{p.numero_transacao} - {p.origem}</p><p className="text-[9px] truncate italic">{p.observacao}</p></div>
                      <span className="text-[10px] bg-yellow-200 px-1 rounded">Vincular</span>
                    </button>
                  ))}
               </div>
               <button onClick={() => setMostrarBuscaSaida(false)} className="text-[9px] text-slate-400 w-full text-center">Cancelar busca</button>
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
                      <div><p className="font-bold text-xs">#{p.numero_transacao} - {p.origem}</p><p className="text-[9px] truncate italic">{p.observacao}</p></div>
                      <span className="text-[10px] bg-orange-200 px-1 rounded text-orange-700">Vincular</span>
                    </button>
                  ))}
               </div>
               <button onClick={() => setMostrarBuscaEntrada(false)} className="text-[9px] text-slate-400 w-full text-center">Cancelar busca</button>
            </div>
          )}

          {/* Dados Gerais - Ultra Compacto */}
          <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 ${ (vendaAnexar || idSaidaAnexar || idEntradaAnexar) ? 'bg-slate-50 p-1 rounded border border-slate-100' : ''}`}>
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

          {/* Financeiro e Pagamentos - Ocultar se os dois lados forem pedidos ou anexos */}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${(vendaAnexar || (tipoSaida.startsWith('pedido') && tipoEntrada.startsWith('pedido')) || (idSaidaAnexar && idEntradaAnexar)) ? 'hidden' : ''}`}>
            {/* Pagamento Venda */}
            <div className={`bg-pink-50/10 p-3 rounded-lg border border-pink-100 space-y-3 ${tipoSaida === 'pedido_venda' || idSaidaAnexar ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
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
            <div className={`bg-blue-50/10 p-3 rounded-lg border border-blue-100 space-y-3 ${tipoEntrada === 'pedido_compra' || idEntradaAnexar ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
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
              CORE ENGINE v3.7
            </div>
            <div className="flex gap-4 items-center">
              <div className="text-center md:text-left">
                <p className="text-[8px] uppercase font-semibold text-pink-400">Total Venda (Final)</p>
                <p className="text-sm font-semibold font-mono">R$ {(totalSaidaAnterior + totalVenda).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="h-6 w-[1px] bg-white/10 hidden md:block"></div>
              <div className="text-center md:text-left">
                <p className="text-[8px] uppercase font-semibold text-blue-400">Total Compra (Final)</p>
                <p className="text-sm font-semibold font-mono">R$ {(totalEntradaAnterior + totalCompra).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
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
