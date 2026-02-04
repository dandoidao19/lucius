'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil, prepararDataParaInsert } from '@/lib/dateUtils'
import SeletorProduto from './SeletorProduto'
import SeletorEntidade from './SeletorEntidade'
import { useFormDraft } from '@/context/FormDraftContext'

type TipoTransacao = 'venda' | 'compra' | 'pedido_venda' | 'pedido_compra' | 'condicional_cliente' | 'condicional_fornecedor'

interface ItemTransacao {
  id: string
  produto_id: string | null
  codigo: string
  descricao: string
  quantidade: number
  categoria: string
  preco_custo: number
  valor_repasse: number
  preco_venda: number
  estoque_atual: number
  observacao_item?: string
  minimizado: boolean
  isNovoCadastro: boolean
}

interface Categoria {
  id: string
  nome: string
  percentual_repasse?: number
}

interface ModalTransacaoUnificadaProps {
  aberto: boolean
  onClose: () => void
  onSucesso: () => void
  transacaoInicial?: {
    id: string
    tipo: TipoTransacao
    data: string
    entidade: string
    total: number
    status_pagamento: string
    quantidade_parcelas: number
    prazoparcelas: string
    observacao: string
    numero_transacao: number
    itens: ItemTransacao[]
  }
}

export default function ModalTransacaoUnificada({ aberto, onClose, onSucesso, transacaoInicial }: ModalTransacaoUnificadaProps) {
  useEffect(() => {
    if (aberto) console.log('🚀 LUCIUS V4.5 - MODAL UNIFICADO CARREGADO')
  }, [aberto])

  const { getDraft, setDraft, clearDraft } = useFormDraft()

  const [tipo, setTipo] = useState<TipoTransacao | ''>(transacaoInicial?.tipo || '')
  const [data, setData] = useState(transacaoInicial?.data || getDataAtualBrasil())
  const [entidade, setEntidade] = useState(transacaoInicial?.entidade || '') // Cliente ou Fornecedor
  const [itens, setItens] = useState<ItemTransacao[]>(transacaoInicial?.itens || [
    {
      id: Date.now().toString(),
      produto_id: null,
      codigo: '',
      descricao: '',
      quantidade: 1,
      categoria: '',
      preco_custo: 0,
      valor_repasse: 0,
      preco_venda: 0,
      estoque_atual: 0,
      minimizado: false,
      isNovoCadastro: false,
    },
  ])
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(transacaoInicial?.quantidade_parcelas || 1)
  const [prazoParcelas, setPrazoParcelas] = useState(transacaoInicial?.prazoparcelas || 'mensal')
  const [statusPagamento, setStatusPagamento] = useState(transacaoInicial?.status_pagamento || 'pendente')
  const [dataVencimento, setDataVencimento] = useState(transacaoInicial?.data || getDataAtualBrasil())
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [resetSeletorKey, setResetSeletorKey] = useState(Date.now())
  const [observacao, setObservacao] = useState(transacaoInicial?.observacao?.replace('[PEDIDO]', '').trim() || '')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [pedidosAbertos, setPedidosAbertos] = useState<any[]>([])
  const [mostrarBuscaPedido, setMostrarBuscaPedido] = useState(false)
  const [idPedidoOrigem, setIdPedidoOrigem] = useState<string | null>(null)
  const [idPedidoAnexar, setIdPedidoAnexar] = useState<string | null>(null)
  const [totalPedidoAnterior, setTotalPedidoAnterior] = useState(0)

  useEffect(() => {
    if (aberto) {
      carregarCategorias()
    }
  }, [aberto])

  // Efeito para carregar rascunho apenas no mount
  useEffect(() => {
    if (!transacaoInicial) {
      const draft = getDraft('loja')
      if (draft) {
        setTipo(draft.tipo || '')
        setData(draft.data || getDataAtualBrasil())
        setEntidade(draft.entidade || '')
        setItens(draft.itens || [])
        setQuantidadeParcelas(draft.quantidadeParcelas || 1)
        setPrazoParcelas(draft.prazoParcelas || 'mensal')
        setStatusPagamento(draft.statusPagamento || 'pendente')
        setDataVencimento(draft.dataVencimento || getDataAtualBrasil())
        setObservacao(draft.observacao || '')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Efeito para salvar rascunho sempre que algo mudar
  useEffect(() => {
    if (aberto && !transacaoInicial && tipo) {
      setDraft('loja', {
        tipo, data, entidade, itens, quantidadeParcelas, prazoParcelas, statusPagamento, dataVencimento, observacao
      })
    }
  }, [aberto, transacaoInicial, tipo, data, entidade, itens, quantidadeParcelas, prazoParcelas, statusPagamento, dataVencimento, observacao, setDraft])

  const resetForm = useCallback(() => {
    setTipo('')
    setData(getDataAtualBrasil())
    setEntidade('')
    setItens([
      {
        id: Date.now().toString(),
        produto_id: null,
        codigo: '',
        descricao: '',
        quantidade: 1,
        categoria: '',
        preco_custo: 0,
        valor_repasse: 0,
        preco_venda: 0,
        estoque_atual: 0,
        minimizado: false,
        isNovoCadastro: false,
      },
    ])
    setQuantidadeParcelas(1)
    setPrazoParcelas('mensal')
    setStatusPagamento('pendente')
    setDataVencimento(getDataAtualBrasil())
    setObservacao('')
    setErro('')
    setIdPedidoAnexar(null)
    setTotalPedidoAnterior(0)
  }, [])

  if (!aberto) return null

  const carregarCategorias = async () => {
    try {
      const { data, error } = await supabase
        .from('categorias_estoque')
        .select('*')
        .order('nome', { ascending: true })

      if (error) throw error
      setCategorias(data || [])
    } catch (error) {
      console.error('Erro ao carregar categorias:', error)
    }
  }

  const calcularTotal = () => {
    return itens.reduce((total, item) => {
      const preco = (tipo === 'compra' || tipo === 'pedido_compra' || tipo === 'condicional_fornecedor')
        ? item.valor_repasse
        : item.preco_venda
      return total + item.quantidade * (preco || 0)
    }, 0)
  }

  const adicionarNovoItem = () => {
    setItens((prev) => {
      const novosItens = prev.map((item, idx) =>
        idx === prev.length - 1 ? { ...item, minimizado: true } : item
      )

      return [
        ...novosItens,
        {
          id: Date.now().toString(),
          produto_id: null,
          codigo: '',
          descricao: '',
          quantidade: 1,
          categoria: categorias[0]?.nome || '',
          preco_custo: 0,
          valor_repasse: 0,
          preco_venda: 0,
          estoque_atual: 0,
          minimizado: false,
          isNovoCadastro: false,
        },
      ]
    })
    setResetSeletorKey(Date.now())
  }

  const removerItem = (idItem: string) => {
    if (itens.length > 1) {
      setItens(itens.filter((item) => item.id !== idItem))
    } else {
      alert('Você deve ter pelo menos um item')
    }
  }

  const atualizarItem = (idItem: string, campo: keyof ItemTransacao, valor: string | number | boolean | null) => {
    setItens(prevItens => {
      const novosItens = prevItens.map(item => {
        if (item.id === idItem) {
          const itemAtualizado = { ...item, [campo]: valor }

          if (campo === 'preco_custo' || campo === 'categoria') {
            const categoriaNome = campo === 'categoria' ? String(valor) : itemAtualizado.categoria
            const precoCusto = campo === 'preco_custo' ? parseFloat(String(valor)) || 0 : itemAtualizado.preco_custo

            const categoriaSelecionada = categorias.find(cat => cat.nome === categoriaNome)

            if (categoriaSelecionada && precoCusto > 0) {
              const percentual = categoriaSelecionada.percentual_repasse || 0
              itemAtualizado.valor_repasse = precoCusto * (1 + percentual / 100)
            } else {
              itemAtualizado.valor_repasse = precoCusto
            }
          }
          return itemAtualizado
        }
        return item
      })
      return novosItens
    })
  }

  const toggleNovoCadastro = (idItem: string) => {
    setItens(
      itens.map((item) =>
        item.id === idItem
          ? {
              ...item,
              isNovoCadastro: !item.isNovoCadastro,
              produto_id: null,
              codigo: '',
              descricao: '',
              categoria: !item.isNovoCadastro ? categorias[0]?.nome || '' : '',
              preco_custo: 0,
              valor_repasse: 0,
              preco_venda: 0,
              estoque_atual: 0,
            }
          : item
      )
    )
    setResetSeletorKey(Date.now())
  }

  const selecionarProduto = (produto: { id: string; descricao?: string; preco_custo?: number; categoria?: string; preco_venda?: number; quantidade?: number }, idItem: string) => {
    const precoCusto = produto.preco_custo || 0
    const categoriaNome = produto.categoria || ''
    const categoriaSelecionada = categorias.find(cat => cat.nome === categoriaNome)
    let valorRepasse = precoCusto

    if (categoriaSelecionada && precoCusto > 0) {
      const percentual = categoriaSelecionada.percentual_repasse || 0
      valorRepasse = precoCusto * (1 + percentual / 100)
    }

    setItens((prevItens) =>
      prevItens.map((item) =>
        item.id === idItem
          ? {
              ...item,
              produto_id: produto.id,
              codigo: (produto as any).codigo || '',
              descricao: produto.descricao || '',
              categoria: categoriaNome,
              preco_custo: precoCusto,
              valor_repasse: valorRepasse,
              preco_venda: produto.preco_venda || 0,
              estoque_atual: produto.quantidade || 0,
            }
          : item
      )
    )
  }

  const ativarItemParaEdicao = (idItem: string) => {
    setItens(itens.map(item => ({
      ...item,
      minimizado: item.id !== idItem
    })))
  }

  const criarTransacoesParceladas = async (
    total: number,
    entidadeNome: string,
    vencimento: string,
    qtdParcelas: number,
    prazo: string,
    tipoFinanceiro: 'entrada' | 'saida',
    parentIds: { id_venda?: string; id_compra?: string; id_condicional?: string },
    numeroTransacaoBase: number,
    isPedidoFinanceiro: boolean = false
  ) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const valorParcela = total / qtdParcelas
    const transacoes = []

    const obsFinal = isPedidoFinanceiro
      ? `[PEDIDO] ${observacao.replace('[PEDIDO]', '').trim()}`.trim()
      : observacao.trim()

    for (let i = 1; i <= qtdParcelas; i++) {
      let dataParcela = vencimento

      if (i > 1) {
        const dt = new Date(vencimento + 'T12:00:00')
        if (prazo === 'diaria') dt.setDate(dt.getDate() + (i - 1))
        else if (prazo === 'semanal') dt.setDate(dt.getDate() + (i - 1) * 7)
        else if (prazo === 'mensal') dt.setMonth(dt.getMonth() + (i - 1))
        dataParcela = dt.toISOString().split('T')[0]
      }

      let statusParcela = 'pendente'
      if (statusPagamento === 'pago') statusParcela = 'pago'
      else if (statusPagamento === 'parcial' && i === 1) statusParcela = 'pago'

      const prefixo = tipoFinanceiro === 'entrada' ? 'Venda' : 'Compra'
      const descricao = `${prefixo} ${entidadeNome} (${i}/${qtdParcelas})`

      transacoes.push({
        user_id: user.id,
        numero_transacao: numeroTransacaoBase,
        descricao: descricao,
        total: valorParcela,
        tipo: tipoFinanceiro,
        data: prepararDataParaInsert(dataParcela),
        status_pagamento: statusParcela,
        observacao: obsFinal || null,
        ...parentIds
      })
    }

    const { error } = await supabase.from('transacoes_loja').insert(transacoes)
    if (error) {
      console.error('Erro ao criar parcelas:', error)
      throw error
    }
  }

  const formatarErro = (err: any): string => {
    if (!err) return 'Erro desconhecido'
    if (typeof err === 'string') return err

    if (err.code === 'PGRST204' || err.code === '23505') {
      return `ERRO DE SCHEMA OU CONSTRAINT: ${err.message}. Detalhes: ${err.details || ''}. POR FAVOR, EXECUTE O SCRIPT SQL V4.5 NO SEU SUPABASE (SQL EDITOR).`
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

  const reverterImpactosOld = async () => {
    if (!transacaoInicial) return;

    try {
      // 1. Reverter Estoque
      for (const item of transacaoInicial.itens) {
        if (item.produto_id) {
          const multiplicador = (transacaoInicial.tipo === 'venda' || transacaoInicial.tipo === 'pedido_venda' || transacaoInicial.tipo === 'condicional_cliente') ? 1 : -1
          await supabase.rpc('atualizar_estoque', {
            produto_id_param: item.produto_id,
            quantidade_param: item.quantidade * multiplicador
          })

          await supabase.from('movimentacoes_estoque').insert({
            produto_id: item.produto_id,
            tipo: multiplicador === 1 ? 'entrada' : 'saida',
            quantidade: item.quantidade,
            observacao: `REVERSÃO P/ EDIÇÃO: #${transacaoInicial.numero_transacao}`
          })
        }
      }

      // 2. Deletar Financeiro
      const prefixo = (transacaoInicial.tipo === 'venda' || transacaoInicial.tipo === 'pedido_venda' || transacaoInicial.tipo === 'condicional_cliente') ? 'Venda' : 'Compra'
      const { data: parcelasLoja } = await supabase
        .from('transacoes_loja')
        .select('id')
        .ilike('descricao', `${prefixo}%${transacaoInicial.entidade}%`)

      if (parcelasLoja && parcelasLoja.length > 0) {
        await supabase.from('transacoes_loja').delete().in('id', parcelasLoja.map(p => p.id))
      }

      // 3. Deletar Itens
      if (transacaoInicial.tipo === 'venda') await supabase.from('itens_venda').delete().eq('venda_id', transacaoInicial.id)
      else if (transacaoInicial.tipo === 'compra') await supabase.from('itens_compra').delete().eq('compra_id', transacaoInicial.id)
      else await supabase.from('itens_condicionais').delete().eq('transacao_id', transacaoInicial.id)

    } catch (err) {
      console.error('Erro ao reverter impactos antigos:', err)
      throw err
    }
  }

  const handleGerarTransacao = async () => {
    if (!entidade.trim()) {
      setErro('Informe o cliente/fornecedor')
      return
    }

    const itensValidos = itens.filter(i => i.descricao.trim())
    if (itensValidos.length === 0) {
      setErro('Adicione pelo menos um item')
      return
    }

    setLoading(true)
    setErro('')

    try {
      const totalFinal = calcularTotal()
      console.log('DEBUG: Payload Transação principal:', {
        tipo, data, entidade, total: totalFinal, statusPagamento, quantidadeParcelas, prazoParcelas, observacao
      })
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      if (transacaoInicial) {
        await reverterImpactosOld()
      }

      const { data: nTrans, error: eTrans } = await supabase.rpc('obter_proximo_numero_transacao')
      if (eTrans) throw eTrans
      let numTransacao = transacaoInicial?.numero_transacao || nTrans

      if (idPedidoAnexar) {
        const { data: pedOrig } = await supabase.from('transacoes_condicionais').select('numero_transacao').eq('id', idPedidoAnexar).single()
        if (pedOrig) numTransacao = pedOrig.numero_transacao
      }

      const total = calcularTotal()
      // APENAS venda ou compra finalizada entra aqui. Condicionais e Pedidos devem ir para handleGerarPedido.
      const isVenda = tipo === 'venda' || tipo === 'pedido_venda'

      let transacaoPrincipalId = transacaoInicial?.id

      if (isVenda) {
        if (transacaoInicial) {
          await supabase.from('vendas').update({
            data_venda: prepararDataParaInsert(data),
            cliente: entidade,
            total,
            quantidade_itens: itensValidos.length,
            status_pagamento: statusPagamento,
            quantidade_parcelas: quantidadeParcelas,
            prazoparcelas: prazoParcelas,
            observacao: observacao.trim() || null
          }).eq('id', transacaoInicial.id)
        } else {
          const { data: novaVenda, error: erroVenda } = await supabase
            .from('vendas')
            .insert({
              numero_transacao: numTransacao,
              data_venda: prepararDataParaInsert(data),
              cliente: entidade,
              total,
              quantidade_itens: itensValidos.length,
              status_pagamento: statusPagamento,
              quantidade_parcelas: quantidadeParcelas,
              prazoparcelas: prazoParcelas,
              observacao: observacao.trim() || null
            })
            .select()
            .single()

          if (erroVenda) throw erroVenda
          transacaoPrincipalId = novaVenda.id
        }

        // Deletar financeiro anterior se for edição
        if (transacaoInicial) {
          await supabase.from('transacoes_loja').delete().eq('id_venda', transacaoPrincipalId)
          // Fallback para legado (v3.8 ou anterior)
          await supabase.from('transacoes_loja').delete()
            .eq('numero_transacao', transacaoInicial.numero_transacao)
            .ilike('descricao', `%${transacaoInicial.entidade}%`)
        }
        await criarTransacoesParceladas(total, entidade, dataVencimento, quantidadeParcelas, prazoParcelas, 'entrada', { id_venda: transacaoPrincipalId }, numTransacao, false)

        for (const item of itensValidos) {
          let prodId = item.produto_id

          // Se for novo cadastro, cria o produto primeiro
          if (item.isNovoCadastro && !prodId) {
            if (!item.codigo.trim()) throw new Error(`O código é obrigatório para o item ${item.descricao}`)

            const { data: novoProd, error: erroNovoProd } = await supabase
              .from('produtos')
              .insert({
                codigo: item.codigo.toUpperCase().trim(),
                descricao: item.descricao.toUpperCase(),
                categoria: item.categoria,
                preco_custo: item.preco_custo,
                valor_repasse: item.valor_repasse,
                preco_venda: item.preco_venda,
                quantidade: 0, // Inicializa com zero, a movimentação ajustará
                user_id: user.id
              })
              .select()
              .single()

            if (erroNovoProd) throw erroNovoProd
            prodId = novoProd.id
          }

          if (prodId) {
            console.log(`📦 DEBUG ESTOQUE: Atualizando (Saída) Produto ${prodId}, Qtd: -${item.quantidade}`)
            const { error: errorRPC } = await supabase.rpc('atualizar_estoque', { produto_id_param: prodId, quantidade_param: -Math.round(item.quantidade) })
            if (errorRPC) console.error('📦 ERRO RPC ESTOQUE (Venda):', formatarErro(errorRPC))

            const dbItem = {
              venda_id: transacaoPrincipalId,
              produto_id: prodId,
              descricao: item.descricao,
              quantidade: item.quantidade,
              preco_venda: item.preco_venda,
              categoria: item.categoria,
              preco_custo: item.preco_custo,
              valor_repasse: item.valor_repasse,
              observacao: item.observacao_item || null
            }

            const { error: erroIt } = await supabase.from('itens_venda').insert(dbItem)
            if (erroIt) throw erroIt

            await supabase.from('movimentacoes_estoque').insert({
              produto_id: prodId,
              tipo: 'saida',
              quantidade: item.quantidade,
              observacao: `Venda #${numTransacao}`
            })
          }
        }
      } else {
        // Fluxo de Compra
        if (transacaoInicial) {
          await supabase.from('compras').update({
            data_compra: prepararDataParaInsert(data),
            fornecedor: entidade,
            total,
            quantidade_itens: itensValidos.length,
            status_pagamento: statusPagamento,
            quantidade_parcelas: quantidadeParcelas,
            prazoparcelas: prazoParcelas,
            observacao: observacao.trim() || null
          }).eq('id', transacaoInicial.id)
        } else {
          const { data: compra, error: erroCompra } = await supabase
            .from('compras')
            .insert({
              numero_transacao: numTransacao,
              data_compra: prepararDataParaInsert(data),
              fornecedor: entidade,
              total,
              quantidade_itens: itensValidos.length,
              status_pagamento: statusPagamento,
              quantidade_parcelas: quantidadeParcelas,
              prazoparcelas: prazoParcelas,
              observacao: observacao.trim() || null
            })
            .select()
            .single()

          if (erroCompra) throw erroCompra
          transacaoPrincipalId = compra.id
        }

        // Deletar financeiro anterior se for edição
        if (transacaoInicial) {
          await supabase.from('transacoes_loja').delete().eq('id_compra', transacaoPrincipalId)
          // Fallback para legado (v3.8 ou anterior)
          await supabase.from('transacoes_loja').delete()
            .eq('numero_transacao', transacaoInicial.numero_transacao)
            .ilike('descricao', `%${transacaoInicial.entidade}%`)
        }
        await criarTransacoesParceladas(total, entidade, dataVencimento, quantidadeParcelas, prazoParcelas, 'saida', { id_compra: transacaoPrincipalId }, numTransacao, false)

        for (const item of itensValidos) {
          let prodId = item.produto_id

          // Se for novo cadastro, cria o produto primeiro
          if (item.isNovoCadastro && !prodId) {
            if (!item.codigo.trim()) throw new Error(`O código é obrigatório para o item ${item.descricao}`)

            const { data: novoProd, error: erroNovoProd } = await supabase
              .from('produtos')
              .insert({
                codigo: item.codigo.toUpperCase().trim(),
                descricao: item.descricao.toUpperCase(),
                categoria: item.categoria,
                preco_custo: item.preco_custo,
                valor_repasse: item.valor_repasse,
                preco_venda: item.preco_venda,
                quantidade: 0,
                user_id: user.id
              })
              .select()
              .single()

            if (erroNovoProd) throw erroNovoProd
            prodId = novoProd.id
          }

          if (prodId) {
            console.log(`📦 DEBUG ESTOQUE: Atualizando (Entrada) Produto ${prodId}, Qtd: ${item.quantidade}`)
            const { error: errorRPC } = await supabase.rpc('atualizar_estoque', { produto_id_param: prodId, quantidade_param: Math.round(item.quantidade) })
            if (errorRPC) console.error('📦 ERRO RPC ESTOQUE (Compra):', formatarErro(errorRPC))

            const dbItem = {
              compra_id: transacaoPrincipalId,
              produto_id: prodId,
              descricao: item.descricao,
              quantidade: item.quantidade,
              preco_custo: item.preco_custo,
              valor_repasse: item.valor_repasse,
              preco_venda: item.preco_venda,
              categoria: item.categoria,
              observacao: item.observacao_item || null
            }

            const { error: erroIt } = await supabase.from('itens_compra').insert(dbItem)
            if (erroIt) throw erroIt

            await supabase.from('movimentacoes_estoque').insert({
              produto_id: prodId,
              tipo: 'entrada',
              quantidade: item.quantidade,
              observacao: `Compra #${numTransacao}`
            })
          }
        }
      }

      if (idPedidoOrigem) {
        // Reverter impacto de estoque do pedido antes de aplicar o da venda/compra final
        // Mas APENAS se for Condicional (Pedidos não impactam estoque desde v4.2)
        const { data: itensPed } = await supabase.from('itens_condicionais').select('*').eq('transacao_id', idPedidoOrigem)
        const { data: pedInfo } = await supabase.from('transacoes_condicionais').select('tipo, observacao').eq('id', idPedidoOrigem).single()

        const isPedidoOrigem = pedInfo?.observacao?.toUpperCase().includes('[PEDIDO]')

        if (itensPed && pedInfo && !isPedidoOrigem) {
          const multReversao = pedInfo.tipo === 'enviado' ? 1 : -1
          for (const itP of itensPed) {
            if (itP.produto_id) {
              await supabase.rpc('atualizar_estoque', {
                produto_id_param: itP.produto_id,
                quantidade_param: itP.quantidade * multReversao
              })
              await supabase.from('movimentacoes_estoque').insert({
                produto_id: itP.produto_id,
                tipo: multReversao === 1 ? 'entrada' : 'saida',
                quantidade: itP.quantidade,
                observacao: `CONVERSÃO PEDIDO -> FINAL: #${numTransacao}`
              })
            }
          }
        }
        await supabase.from('transacoes_condicionais').update({ status: 'realizado' }).eq('id', idPedidoOrigem)
      }

      alert('✅ Transação gerada com sucesso!')
      clearDraft('loja')
      resetForm()
      onSucesso()
      onClose()
    } catch (err: any) {
      const msgErro = formatarErro(err)
      console.error('Erro detalhado (Transação):', err, msgErro)
      setErro(msgErro)
    } finally {
      setLoading(false)
    }
  }

  const handleGerarPedido = async () => {
    if (!entidade.trim()) {
      setErro('Informe a origem/destino')
      return
    }

    const itensValidos = itens.filter(i => i.descricao.trim())
    if (itensValidos.length === 0) {
      setErro('Adicione pelo menos um item')
      return
    }

    setLoading(true)
    setErro('')

    try {
      const totalNovosItens = calcularTotal()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      if (transacaoInicial) {
        await reverterImpactosOld()
      }

      const { data: nTrans, error: eTrans } = await supabase.rpc('obter_proximo_numero_transacao')
      if (eTrans) throw eTrans
      let numTransacao = transacaoInicial?.numero_transacao || nTrans

      if (idPedidoAnexar) {
        const { data: pedOrig } = await supabase.from('transacoes_condicionais').select('numero_transacao').eq('id', idPedidoAnexar).single()
        if (pedOrig) numTransacao = pedOrig.numero_transacao
      }

      const isVendaPedido = tipo === 'venda' || tipo === 'pedido_venda' || tipo === 'condicional_cliente'
      const isPedidoTipo = tipo === 'pedido_venda' || tipo === 'pedido_compra'
      const prefixoPedido = isPedidoTipo ? '[PEDIDO] ' : ''

      let transacaoId = transacaoInicial?.id || idPedidoAnexar
      let totalFinal = totalNovosItens

      if (transacaoId) {
        if (idPedidoAnexar) {
           const { data: pOld } = await supabase.from('transacoes_condicionais').select('total').eq('id', idPedidoAnexar).single()
           totalFinal = (pOld?.total || 0) + totalNovosItens
        }

        await supabase.from('transacoes_condicionais').update({
          tipo: isVendaPedido ? 'enviado' : 'recebido',
          origem: entidade,
          data_transacao: prepararDataParaInsert(data),
          observacao: (prefixoPedido + observacao).trim() || null,
          status: 'pendente',
          total: totalFinal,
          quantidade_parcelas: quantidadeParcelas,
          prazoparcelas: prazoParcelas,
          data_vencimento: prepararDataParaInsert(dataVencimento)
        }).eq('id', transacaoId)
      } else {
        const { data: transacao, error: erroTransacao } = await supabase
          .from('transacoes_condicionais')
          .insert({
            numero_transacao: numTransacao,
            tipo: isVendaPedido ? 'enviado' : 'recebido',
            origem: entidade,
            data_transacao: prepararDataParaInsert(data),
            observacao: (prefixoPedido + observacao).trim() || null,
            status: 'pendente',
            total: totalFinal,
            quantidade_parcelas: quantidadeParcelas,
            prazoparcelas: prazoParcelas,
            data_vencimento: prepararDataParaInsert(dataVencimento)
          })
          .select()
          .single()

        if (erroTransacao) throw erroTransacao
        transacaoId = transacao.id
      }

      // 1. Gerar/Atualizar Financeiro
      if (isPedidoTipo) {
        // Deletar financeiro anterior (se houver) para recalcular o total
        await supabase.from('transacoes_loja').delete().eq('id_condicional', transacaoId)

        // Fallback para legado
        const numOriginal = transacaoInicial?.numero_transacao || (pedidosAbertos.find(p => p.id === idPedidoAnexar)?.numero_transacao)
        if (numOriginal) {
          await supabase.from('transacoes_loja').delete()
            .eq('numero_transacao', numOriginal)
            .ilike('descricao', `%${entidade}%`)
        }

        await criarTransacoesParceladas(
          totalFinal,
          entidade,
          dataVencimento,
          quantidadeParcelas,
          prazoParcelas,
          isVendaPedido ? 'entrada' : 'saida',
          { id_condicional: transacaoId || undefined },
          numTransacao,
          true
        )
      }

      for (const item of itensValidos) {
        let prodId = item.produto_id

        // Suporte a novo cadastro no condicional também
        if (item.isNovoCadastro && !prodId) {
          if (!item.codigo.trim()) throw new Error(`O código é obrigatório para o item ${item.descricao}`)

          const { data: novoProd, error: erroNovoProd } = await supabase
            .from('produtos')
            .insert({
              codigo: item.codigo.toUpperCase().trim(),
              descricao: item.descricao.toUpperCase(),
              categoria: item.categoria,
              preco_custo: item.preco_custo,
              valor_repasse: item.valor_repasse,
              preco_venda: item.preco_venda,
              quantidade: 0,
              user_id: user.id
            })
            .select()
            .single()

          if (erroNovoProd) throw erroNovoProd
          prodId = novoProd.id
        }

        const dbItem = {
          transacao_id: transacaoId,
          produto_id: prodId,
          descricao: item.descricao,
          quantidade: item.quantidade,
          categoria: item.categoria,
          preco_custo: item.preco_custo,
          valor_repasse: item.valor_repasse,
          preco_venda: item.preco_venda,
          status: 'pendente',
          observacao: item.observacao_item || null
        }

        const { error: erroIt } = await supabase.from('itens_condicionais').insert(dbItem)
        if (erroIt) throw erroIt

        // 2. Impacto no Estoque (Apenas se NÃO for Pedido)
        if (prodId && !isPedidoTipo) {
          const multiplicadorEstoque = isVendaPedido ? -1 : 1
          console.log(`📦 DEBUG ESTOQUE: Atualizando (Condicional) Produto ${prodId}, Qtd: ${item.quantidade * multiplicadorEstoque}`)
          const { error: errorRPC } = await supabase.rpc('atualizar_estoque', {
            produto_id_param: prodId,
            quantidade_param: Math.round(item.quantidade * multiplicadorEstoque)
          })
          if (errorRPC) console.error('📦 ERRO RPC ESTOQUE (Pedido):', formatarErro(errorRPC))

          await supabase.from('movimentacoes_estoque').insert({
            produto_id: prodId,
            tipo: isVendaPedido ? 'saida' : 'entrada',
            quantidade: item.quantidade,
            observacao: `Condicional #${numTransacao}`
          })
        } else if (prodId && isPedidoTipo) {
           console.log(`📦 INFO: Pedido #${numTransacao} não gera impacto em estoque imediato.`)
        }
      }

      alert('✅ Pedido/Condicional gerado com sucesso!')
      clearDraft('loja')
      resetForm()
      onSucesso()
      onClose()
    } catch (err: any) {
      const msgErro = formatarErro(err)
      console.error('Erro detalhado (Pedido):', err, msgErro)
      setErro(msgErro)
    } finally {
      setLoading(false)
    }
  }

  const buscarUltimoPrecoCusto = async (descricao: string, idItem: string) => {
    try {
      const { data } = await supabase
        .from('produtos')
        .select('preco_custo')
        .ilike('descricao', `%${descricao}%`)
        .order('data_ultima_compra', { ascending: false })
        .limit(1)
        .single()

      if (data) {
        atualizarItem(idItem, 'preco_custo', data.preco_custo)
      }
    } catch (error) {
      console.error('Erro ao buscar último preço:', error)
    }
  }

  const handleTipoSelect = (novoTipo: TipoTransacao) => {
    setTipo(novoTipo)
    setErro('')
    setIdPedidoAnexar(null)
    setIdPedidoOrigem(null)
    if (novoTipo === 'venda' || novoTipo === 'compra' || novoTipo === 'pedido_venda' || novoTipo === 'pedido_compra') {
      buscarPedidosAbertos(novoTipo)
    }
  }

  const buscarPedidosAbertos = async (tipoAtual: string) => {
    try {
      let tipoCond = ''
      if (tipoAtual === 'venda') tipoCond = 'enviado'
      else if (tipoAtual === 'compra') tipoCond = 'recebido'
      else if (tipoAtual === 'pedido_venda') tipoCond = 'enviado'
      else if (tipoAtual === 'pedido_compra') tipoCond = 'recebido'

      const { data, error } = await supabase
        .from('transacoes_condicionais')
        .select('*, itens_condicionais(*)')
        .eq('tipo', tipoCond)
        .eq('status', 'pendente')
        .ilike('observacao', '%[PEDIDO]%')

      if (error) throw error
      setPedidosAbertos(data || [])
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error)
    }
  }

  const importarPedido = (pedido: any) => {
    const isModoAnexar = tipo === 'pedido_venda' || tipo === 'pedido_compra'

    if (isModoAnexar) {
       if (!window.confirm(`Deseja ADICIONAR os novos itens ao Pedido #${pedido.numero_transacao} existente?`)) return
       setIdPedidoAnexar(pedido.id)
       setTotalPedidoAnterior(pedido.total || 0)
       setEntidade(pedido.origem)
       setData(pedido.data_transacao.split('T')[0])
       setObservacao(pedido.observacao.replace('[PEDIDO]', '').trim())

       // Restaurar estrutura financeira (v3.11/v3.12)
       if (pedido.quantidade_parcelas) setQuantidadeParcelas(pedido.quantidade_parcelas)
       if (pedido.prazoparcelas) setPrazoParcelas(pedido.prazoparcelas)
       if (pedido.data_vencimento) setDataVencimento(pedido.data_vencimento.split('T')[0])

       setMostrarBuscaPedido(false)
       return
    }

    if (!window.confirm(`Deseja importar os itens do Pedido #${pedido.numero_transacao}?`)) return

    setEntidade(pedido.origem)
    setObservacao(pedido.observacao.replace('[PEDIDO]', '').trim())

    // Restaurar estrutura financeira do pedido
    if (pedido.quantidade_parcelas) setQuantidadeParcelas(pedido.quantidade_parcelas)
    if (pedido.prazoparcelas) setPrazoParcelas(pedido.prazoparcelas)
    if (pedido.data_vencimento) setDataVencimento(pedido.data_vencimento.split('T')[0])

    const novosItens: ItemTransacao[] = pedido.itens_condicionais.map((it: any) => ({
      id: Date.now().toString() + Math.random(),
      produto_id: it.produto_id,
      descricao: it.descricao,
      quantidade: it.quantidade,
      categoria: it.categoria,
      preco_custo: it.preco_custo || 0,
      valor_repasse: it.preco_custo || 0, // Simplificado
      preco_venda: it.preco_venda || 0,
      estoque_atual: 0,
      minimizado: true,
      isNovoCadastro: false
    }))

    setItens(novosItens)
    setIdPedidoOrigem(pedido.id)
    setMostrarBuscaPedido(false)
    // Se for compra, tentar buscar valor de repasse baseado na categoria
    if (tipo === 'compra') {
      novosItens.forEach(it => {
        const cat = categorias.find(c => c.nome === it.categoria)
        if (cat && it.preco_custo > 0) {
           it.valor_repasse = it.preco_custo * (1 + (cat.percentual_repasse || 0) / 100)
        }
      })
      setItens([...novosItens])
    }
  }

  const handleFechar = () => {
    onClose()
  }

  const handleCancelar = () => {
    if (window.confirm('Deseja realmente cancelar o lançamento? Todos os dados preenchidos serão perdidos.')) {
      clearDraft('loja')
      resetForm()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
      <div className={`bg-white rounded shadow-xl w-full max-h-[95vh] overflow-hidden flex flex-col transition-all border border-purple-200 ${tipo ? 'max-w-4xl' : 'max-w-md'}`}>
        {/* Cabeçalho */}
        <div className="bg-purple-600 px-3 py-1 flex justify-between items-center text-white border-b border-purple-700">
          <h2 className="text-xs font-semibold uppercase tracking-widest">Lançar Nova Transação</h2>
          <button onClick={handleFechar} className="hover:bg-purple-700 p-1 rounded text-lg">✕</button>
        </div>

        <div className="p-3 overflow-y-auto flex-1 text-xs">
          {erro && (
            <div className={`mb-4 border-l-4 p-3 rounded shadow-md ${erro.includes('V4.3') ? 'bg-orange-100 border-orange-600 animate-pulse' : 'bg-red-50 border-red-500'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className={`font-black uppercase tracking-tighter text-[11px] ${erro.includes('V4.3') ? 'text-orange-900' : 'text-red-800'}`}>
                    {erro.includes('V4.3') ? '🚨 AÇÃO NECESSÁRIA NO SUPABASE 🚨' : 'Erro detectado:'}
                  </p>
                  <p className={`font-bold text-sm leading-tight mt-1 ${erro.includes('V4.3') ? 'text-orange-800' : 'text-red-700'}`}>{erro}</p>
                </div>
                <button onClick={() => setErro('')} className="text-red-500 hover:text-red-700 p-1">✕</button>
              </div>
              {erro.includes('V4.5') && (
                <div className="mt-3 bg-white/50 p-2 rounded border border-orange-200">
                   <p className="text-[10px] text-orange-900 font-bold">Como resolver:</p>
                   <ol className="list-decimal ml-4 text-[9px] text-orange-800 mt-1 space-y-1">
                      <li>Abra o seu Dashboard do Supabase.</li>
                      <li>Vá em <b>SQL Editor</b> (menu lateral esquerdo).</li>
                      <li>Copie o conteúdo do arquivo <b>SQL_MASTER_V4_5.sql</b> (disponível na raiz do projeto).</li>
                      <li>Cole no editor e clique em <b>RUN</b>.</li>
                   </ol>
                </div>
              )}
            </div>
          )}

          {!tipo ? (
            <div className="space-y-4">
              <p className="text-center text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-2">Selecione o tipo de transação</p>
              <div className="grid grid-cols-1 gap-2.5">
                <button
                  onClick={() => handleTipoSelect('venda')}
                  className="group relative overflow-hidden p-3 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-all shadow-md active:scale-[0.98] border border-green-700 flex justify-between items-center"
                >
                  <span className="font-black text-xs uppercase tracking-wider">💰 VENDA</span>
                  <span className="text-[9px] opacity-80 font-semibold uppercase italic">Direto ao estoque e financeiro</span>
                </button>

                <button
                  onClick={() => handleTipoSelect('compra')}
                  className="group relative overflow-hidden p-3 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all shadow-md active:scale-[0.98] border border-red-700 flex justify-between items-center"
                >
                  <span className="font-black text-xs uppercase tracking-wider">📥 COMPRA</span>
                  <span className="text-[9px] opacity-80 font-semibold uppercase italic">Entrada de mercadoria</span>
                </button>

                <div className="h-px bg-gray-200 my-1"></div>

                <button
                  onClick={() => handleTipoSelect('pedido_venda')}
                  className="group relative overflow-hidden p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-md active:scale-[0.98] border border-blue-700 flex justify-between items-center"
                >
                  <span className="font-black text-xs uppercase tracking-wider">📝 P. VENDA (RESERVA)</span>
                  <span className="text-[9px] opacity-80 font-semibold uppercase italic">Reserva p/ Cliente</span>
                </button>

                <button
                  onClick={() => handleTipoSelect('pedido_compra')}
                  className="group relative overflow-hidden p-3 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-all shadow-md active:scale-[0.98] border border-orange-700 flex justify-between items-center"
                >
                  <span className="font-black text-xs uppercase tracking-wider">📦 P. COMPRA (PEDIDO)</span>
                  <span className="text-[9px] opacity-80 font-semibold uppercase italic">Solicitação Fornecedor</span>
                </button>

                <div className="h-px bg-gray-200 my-1"></div>

                <button
                  onClick={() => handleTipoSelect('condicional_cliente')}
                  className="group relative overflow-hidden p-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-all shadow-md active:scale-[0.98] border border-purple-700 flex justify-between items-center"
                >
                  <span className="font-black text-xs uppercase tracking-wider">✨ COND. CLIENTE</span>
                  <span className="text-[9px] opacity-80 font-semibold uppercase italic">Envio para teste</span>
                </button>

                <button
                  onClick={() => handleTipoSelect('condicional_fornecedor')}
                  className="group relative overflow-hidden p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow-md active:scale-[0.98] border border-indigo-700 flex justify-between items-center"
                >
                  <span className="font-black text-xs uppercase tracking-wider">🔄 COND. FORNECEDOR</span>
                  <span className="text-[9px] opacity-80 font-semibold uppercase italic">Recebimento p/ teste</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
               <div className={`flex justify-between items-center p-2 rounded border ${idPedidoAnexar ? 'bg-orange-50 border-orange-200' : 'bg-purple-50 border-purple-100'}`}>
                 <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-purple-800 uppercase tracking-tighter">
                      {idPedidoAnexar ? '📍 ANEXANDO AO PEDIDO EXISTENTE' : `Tipo: ${tipo.replace('_', ' ').toUpperCase()}`}
                    </span>
                    {(tipo === 'venda' || tipo === 'compra' || tipo === 'pedido_venda' || tipo === 'pedido_compra') && pedidosAbertos.length > 0 && (
                      <button
                        onClick={() => setMostrarBuscaPedido(!mostrarBuscaPedido)}
                        className="bg-yellow-500 text-white px-2 py-0.5 rounded text-[10px] font-semibold animate-pulse shadow-sm"
                      >
                        {tipo.startsWith('pedido') ? 'CONTINUAR PEDIDO EXISTENTE ➕' : `${pedidosAbertos.length} PEDIDO(S) EM ABERTO 🔍`}
                      </button>
                    )}
                 </div>
                 <button
                   onClick={() => { setTipo(''); setIdPedidoAnexar(null); }}
                   className="text-xs font-bold text-purple-600 hover:underline"
                 >
                   {idPedidoAnexar ? 'CANCELAR ANEXO' : 'ALTERAR TIPO'}
                 </button>
               </div>

               {mostrarBuscaPedido && (
                 <div className="bg-yellow-50 border border-yellow-200 p-2 rounded space-y-2">
                    <p className="font-bold text-yellow-800 text-[10px] uppercase">
                      {tipo.startsWith('pedido') ? 'Selecione o pedido para adicionar novos itens:' : 'Selecione um pedido para importar:'}
                    </p>
                    <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
                      {pedidosAbertos.map(p => (
                        <button
                          key={p.id}
                          onClick={() => importarPedido(p)}
                          className="flex justify-between items-center p-2 bg-white border border-yellow-100 hover:bg-yellow-100 text-left rounded"
                        >
                          <div>
                            <p className="font-bold text-gray-700">#{p.numero_transacao} - {p.origem}</p>
                            <p className="text-[10px] text-gray-500 truncate w-64">{p.observacao}</p>
                          </div>
                          <span className="text-[10px] font-mono bg-yellow-200 px-1 rounded">Importar</span>
                        </button>
                      ))}
                    </div>
                 </div>
               )}

               {/* Data e Entidade */}
               <div className={`grid grid-cols-1 md:grid-cols-2 gap-3`}>
                 <div className={(idPedidoAnexar || transacaoInicial) ? 'opacity-60 pointer-events-none' : ''}>
                   <label className="block text-xs font-medium text-gray-700 mb-1">Data</label>
                   <input
                     type="date"
                     value={data || ''}
                     onChange={(e) => !idPedidoAnexar && !transacaoInicial && setData(e.target.value)}
                     className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                     readOnly={!!idPedidoAnexar || !!transacaoInicial}
                   />
                 </div>
                 <div className={idPedidoAnexar ? 'opacity-60 pointer-events-none' : ''}>
                   <label className="block text-xs font-medium text-gray-700 mb-1">
                     {(tipo === 'compra' || tipo === 'pedido_compra' || tipo === 'condicional_fornecedor') ? 'Fornecedor' : 'Cliente'} *
                   </label>
                   <SeletorEntidade
                     valor={entidade}
                     onChange={(val) => setEntidade(val)}
                     tipo={(tipo === 'compra' || tipo === 'pedido_compra' || tipo === 'condicional_fornecedor') ? 'fornecedor' : 'cliente'}
                     placeholder={`Nome do ${(tipo === 'compra' || tipo === 'pedido_compra' || tipo === 'condicional_fornecedor') ? 'fornecedor' : 'cliente'}`}
                   />
                 </div>
               </div>

               {/* Lista de Itens */}
               <div className="border-t pt-2">
                 <div className="flex justify-between items-center mb-2">
                   <h3 className="font-semibold text-gray-700 text-xs">Itens da Transação</h3>
                   <button
                     type="button"
                     onClick={adicionarNovoItem}
                     className="text-[10px] bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded"
                   >
                     + Item
                   </button>
                 </div>

                 <div className="space-y-2">
                   {itens.map((item, idx) => (
                     <div key={item.id} className={`border rounded p-2 transition-colors ${item.minimizado ? 'bg-gray-50 border-gray-200' : 'bg-purple-50 border-purple-300 shadow-inner'}`}>
                       {item.minimizado ? (
                         <div className="flex justify-between items-center">
                           <span className="text-xs text-gray-700 font-medium truncate flex-1" onClick={() => ativarItemParaEdicao(item.id)}>
                             {idx + 1}. {item.descricao || '(Sem descrição)'} - {item.quantidade}x R$ {((tipo === 'compra' || tipo === 'pedido_compra' || tipo === 'condicional_fornecedor' ? item.valor_repasse : item.preco_venda) || 0).toFixed(2)}
                           </span>
                           <div className="flex gap-2">
                             <button onClick={() => ativarItemParaEdicao(item.id)} className="text-blue-600 text-[10px]">Editar</button>
                             <button onClick={() => removerItem(item.id)} className="text-red-600 text-[10px]">Remover</button>
                           </div>
                         </div>
                       ) : (
                         <div className="space-y-2">
                           <div className="flex justify-between items-center">
                             <span className="text-xs font-bold text-blue-800">Item {idx + 1}</span>
                             <label className="flex items-center gap-1 cursor-pointer">
                               <input
                                 type="checkbox"
                                 checked={item.isNovoCadastro || false}
                                 onChange={() => toggleNovoCadastro(item.id)}
                                 className="w-3 h-3"
                               />
                               <span className="text-xs font-medium">Novo Cadastro</span>
                             </label>
                           </div>

                           {!item.isNovoCadastro ? (
                             <SeletorProduto
                               key={`seletor-${resetSeletorKey}-${item.id}`}
                               onSelecionarProduto={(p) => selecionarProduto(p, item.id)}
                               placeholder="Buscar produto..."
                               descricaoPreenchida={item.descricao || ''}
                             />
                           ) : (
                             <div className="space-y-2">
                               <div className="grid grid-cols-3 gap-2">
                                 <div className="col-span-1">
                                    <label className="block text-[10px] text-gray-600 font-bold uppercase">Código *</label>
                                    <input
                                      type="text"
                                      value={item.codigo || ''}
                                      onChange={(e) => atualizarItem(item.id, 'codigo', e.target.value)}
                                      placeholder="Ex: REF001"
                                      className="w-full px-2 py-1 text-xs border border-purple-300 rounded uppercase font-mono"
                                    />
                                 </div>
                                 <div className="col-span-2">
                                    <label className="block text-[10px] text-gray-600 font-bold uppercase">Descrição *</label>
                                    <input
                                      type="text"
                                      value={item.descricao || ''}
                                      onChange={(e) => atualizarItem(item.id, 'descricao', e.target.value)}
                                      placeholder="Descrição do novo produto"
                                      className="w-full px-2 py-1 text-xs border border-purple-300 rounded"
                                    />
                                 </div>
                               </div>
                             </div>
                           )}

                           {item.isNovoCadastro ? (
                             <>
                               <div className="grid grid-cols-2 gap-2">
                                 <div>
                                   <label className="block text-xs text-gray-600 font-bold">Categoria *</label>
                                   <select
                                     value={item.categoria || ''}
                                     onChange={(e) => atualizarItem(item.id, 'categoria', e.target.value)}
                                     className="w-full px-2 py-1 text-xs border border-purple-300 bg-white rounded"
                                   >
                                     <option value="">Selecione...</option>
                                     {categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                                   </select>
                                 </div>
                                 <div>
                                   <label className="block text-xs text-gray-600 font-bold">Quantidade *</label>
                                   <input
                                     type="number"
                                     value={item.quantidade ?? 0}
                                     onChange={(e) => atualizarItem(item.id, 'quantidade', parseInt(e.target.value) || 0)}
                                     className="w-full px-2 py-1 text-xs border border-purple-300 bg-white rounded"
                                   />
                                 </div>
                               </div>
                               <div className="grid grid-cols-3 gap-2">
                                 <div>
                                   <label className="block text-xs text-gray-600 font-bold text-red-600">Preço Custo *</label>
                                   <input
                                     type="number"
                                     step="0.01"
                                     value={item.preco_custo ?? 0}
                                     onChange={(e) => atualizarItem(item.id, 'preco_custo', parseFloat(e.target.value) || 0)}
                                     className="w-full px-2 py-1 text-xs border border-red-200 bg-white rounded"
                                   />
                                 </div>
                                 <div>
                                   <label className="block text-xs text-gray-600 font-bold text-orange-600">Valor Repasse</label>
                                   <input
                                     type="number"
                                     step="0.01"
                                     value={item.valor_repasse ?? 0}
                                     onChange={(e) => atualizarItem(item.id, 'valor_repasse', parseFloat(e.target.value) || 0)}
                                     className="w-full px-2 py-1 text-xs border border-orange-200 bg-orange-50 rounded"
                                   />
                                 </div>
                                 <div>
                                   <label className="block text-xs text-gray-600 font-bold text-green-600">Preço Venda *</label>
                                   <input
                                     type="number"
                                     step="0.01"
                                     value={item.preco_venda ?? 0}
                                     onChange={(e) => atualizarItem(item.id, 'preco_venda', parseFloat(e.target.value) || 0)}
                                     className="w-full px-2 py-1 text-xs border border-green-200 bg-white rounded"
                                   />
                                 </div>
                               </div>
                             </>
                           ) : (
                             <>
                               <div className="grid grid-cols-3 gap-2">
                                 <div>
                                   <label className="block text-xs text-gray-600">Categoria</label>
                                   <input type="text" value={item.categoria || ''} disabled className="w-full px-2 py-1 text-xs bg-gray-100 border rounded" />
                                 </div>
                                 <div>
                                   <label className="block text-xs text-gray-600">Quantidade</label>
                                   <input
                                     type="number"
                                     value={item.quantidade ?? 0}
                                     onChange={(e) => atualizarItem(item.id, 'quantidade', parseInt(e.target.value) || 0)}
                                     className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                   />
                                 </div>
                                 <div>
                                   <label className="block text-xs text-gray-600">Preço</label>
                                  <div className="flex gap-1">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={(tipo === 'compra' || tipo === 'pedido_compra' || tipo === 'condicional_fornecedor' ? item.preco_custo : item.preco_venda) ?? 0}
                                      onChange={(e) => atualizarItem(item.id, tipo === 'compra' || tipo === 'pedido_compra' || tipo === 'condicional_fornecedor' ? 'preco_custo' : 'preco_venda', parseFloat(e.target.value) || 0)}
                                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                    />
                                    {(tipo === 'compra' || tipo === 'pedido_compra' || tipo === 'condicional_fornecedor') && (
                                      <button
                                        type="button"
                                        onClick={() => buscarUltimoPrecoCusto(item.descricao, item.id)}
                                        className="bg-blue-500 text-white px-1 rounded text-[8px]"
                                        title="Buscar último custo"
                                      >
                                        🔍
                                      </button>
                                    )}
                                  </div>
                                 </div>
                               </div>

                               {(tipo === 'compra' || tipo === 'pedido_compra' || tipo === 'condicional_fornecedor') && (
                                 <div className="grid grid-cols-2 gap-2 mt-1">
                                    <div>
                                      <label className="block text-xs text-gray-600">Valor Repasse (Calc.)</label>
                                      <input type="text" value={`R$ ${(item.valor_repasse || 0).toFixed(2)}`} disabled className="w-full px-2 py-1 text-xs bg-gray-100 border rounded" />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-600">Preço Venda Sugerido</label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={item.preco_venda ?? 0}
                                        onChange={(e) => atualizarItem(item.id, 'preco_venda', parseFloat(e.target.value) || 0)}
                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                      />
                                    </div>
                                 </div>
                               )}
                             </>
                           )}

                           <div>
                             <label className="block text-[10px] text-gray-600">Observação do Item</label>
                             <input
                               type="text"
                               value={item.observacao_item || ''}
                               onChange={(e) => atualizarItem(item.id, 'observacao_item', e.target.value)}
                               placeholder="Ex: Cor, tamanho, detalhes..."
                               className="w-full px-2 py-1 text-[10px] border border-gray-300 rounded"
                             />
                           </div>

                           <div className="flex justify-end gap-2 pt-1">
                              <button onClick={() => atualizarItem(item.id, 'minimizado', true)} className="text-[10px] text-gray-500">Minimizar</button>
                              <button onClick={() => removerItem(item.id)} className="text-[10px] text-red-500">Remover</button>
                           </div>
                         </div>
                       )}
                     </div>
                   ))}
                 </div>
               </div>

               {/* Informações de Pagamento (Apenas para Transações e se não for anexo) */}
               <div className={`border-t pt-2 border-gray-100 ${(idPedidoAnexar || transacaoInicial) ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                 <h3 className="font-bold text-gray-700 text-xs mb-1 uppercase tracking-tight">
                   Pagamento / Condições {(idPedidoAnexar || transacaoInicial) && '(Já definido no pedido original)'}
                 </h3>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                   <div>
                     <label className="block text-xs text-gray-600">Vencimento</label>
                     <input
                       type="date"
                       value={dataVencimento || ''}
                       onChange={(e) => !idPedidoAnexar && !transacaoInicial && setDataVencimento(e.target.value)}
                       className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                       readOnly={!!idPedidoAnexar || !!transacaoInicial}
                     />
                   </div>
                   <div>
                     <label className="block text-xs text-gray-600">Parcelas</label>
                     <input
                       type="number"
                       min="1"
                       value={quantidadeParcelas ?? 1}
                       onChange={(e) => !idPedidoAnexar && !transacaoInicial && setQuantidadeParcelas(parseInt(e.target.value) || 1)}
                       className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                       readOnly={!!idPedidoAnexar || !!transacaoInicial}
                     />
                   </div>
                   <div>
                     <label className="block text-xs text-gray-600">Prazo</label>
                     <select
                       value={prazoParcelas || 'mensal'}
                       onChange={(e) => !idPedidoAnexar && !transacaoInicial && setPrazoParcelas(e.target.value)}
                       className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                       disabled={!!idPedidoAnexar || !!transacaoInicial}
                     >
                       <option value="diaria">Diária</option>
                       <option value="semanal">Semanal</option>
                       <option value="mensal">Mensal</option>
                     </select>
                   </div>
                   <div>
                     <label className="block text-xs text-gray-600">Status</label>
                     <select
                       value={statusPagamento || 'pendente'}
                       onChange={(e) => !idPedidoAnexar && !transacaoInicial && setStatusPagamento(e.target.value)}
                       className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                       disabled={!!idPedidoAnexar || !!transacaoInicial}
                     >
                       <option value="pendente">Pendente</option>
                       <option value="pago">Pago</option>
                       <option value="parcial">Parcial</option>
                     </select>
                   </div>
                 </div>
               </div>

               {/* Observações */}
               <div>
                 <label className="block text-xs font-medium text-gray-700 mb-1">Observações</label>
                 <textarea
                   value={observacao || ''}
                   onChange={(e) => setObservacao(e.target.value)}
                   placeholder="Notas adicionais sobre esta operação..."
                   className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                   rows={2}
                 />
               </div>

               <div className="bg-purple-100 p-3 rounded flex flex-col gap-1 border border-purple-200 shadow-sm">
                  {idPedidoAnexar && (
                    <div className="flex justify-between items-center text-[10px] text-purple-800 font-bold uppercase">
                      <span>Total Anterior:</span>
                      <span>R$ {totalPedidoAnterior.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[10px] text-purple-800 font-bold uppercase">
                      <span>Novos Itens:</span>
                      <span>R$ {calcularTotal().toFixed(2)}</span>
                  </div>
                  <div className="h-[1px] bg-purple-300 my-0.5"></div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-purple-900 uppercase text-xs">TOTAL FINAL:</span>
                    <span className="text-xl font-black text-purple-700">R$ {(totalPedidoAnterior + calcularTotal()).toFixed(2)}</span>
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* Rodapé fixo quando tipo selecionado */}
        {tipo && (
          <div className="p-4 border-t bg-slate-900 flex justify-between items-center gap-3 shadow-[0_-4px_10px_rgba(0,0,0,0.1)] relative">
            <div className="absolute top-0 left-4 -translate-y-1/2 bg-slate-800 text-[8px] px-2 py-0.5 rounded text-slate-400 font-mono border border-slate-700">
              CORE ENGINE v4.5
            </div>
            <button
              onClick={handleCancelar}
              className="px-6 py-2.5 bg-slate-700 hover:bg-red-700 text-white rounded-lg font-bold transition-all flex items-center justify-center uppercase text-[11px] shadow-lg active:scale-95 border border-slate-600"
            >
              Cancelar Lançamento
            </button>
            <div className="flex gap-3 items-center">
              {(tipo === 'pedido_venda' || tipo === 'pedido_compra' || tipo === 'condicional_cliente' || tipo === 'condicional_fornecedor') && (
                <button
                  onClick={handleGerarPedido}
                  disabled={loading}
                  className="px-6 py-2.5 bg-yellow-500 hover:bg-yellow-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-lg font-black transition-all shadow-lg flex items-center justify-center uppercase text-[11px] active:scale-95"
                >
                  {loading ? 'Processando...' : transacaoInicial ? '💾 Salvar Pedido' : '📝 Gerar Pedido'}
                </button>
              )}
              {(tipo === 'venda' || tipo === 'compra') && (
                <button
                  onClick={handleGerarTransacao}
                  disabled={loading}
                  className="px-6 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg font-black transition-all shadow-lg flex items-center justify-center uppercase text-[11px] active:scale-95"
                >
                  {loading ? 'Processando...' : transacaoInicial ? '💾 Salvar Transação' : '💰 Gerar Transação'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
