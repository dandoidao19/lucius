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
  const { getDraft, setDraft, clearDraft } = useFormDraft()

  const [tipo, setTipo] = useState<TipoTransacao | ''>(transacaoInicial?.tipo || '')
  const [data, setData] = useState(transacaoInicial?.data || getDataAtualBrasil())
  const [entidade, setEntidade] = useState(transacaoInicial?.entidade || '') // Cliente ou Fornecedor
  const [itens, setItens] = useState<ItemTransacao[]>(transacaoInicial?.itens || [
    {
      id: Date.now().toString(),
      produto_id: null,
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
  const [, setErro] = useState('')
  const [pedidosAbertos, setPedidosAbertos] = useState<any[]>([])
  const [mostrarBuscaPedido, setMostrarBuscaPedido] = useState(false)
  const [idPedidoOrigem, setIdPedidoOrigem] = useState<string | null>(null)

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
    tipoFinanceiro: 'entrada' | 'saida'
  ) => {
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

      let statusParcela = 'pendente'
      if (statusPagamento === 'pago') statusParcela = 'pago'
      else if (statusPagamento === 'parcial' && i === 1) statusParcela = 'pago'

      const timestamp = Date.now()
      const numeroTransacao = parseInt(`${timestamp.toString().slice(-6)}${i}`.padStart(6, '0'))
      const prefixo = tipoFinanceiro === 'entrada' ? 'Venda' : 'Compra'
      const descricao = `${prefixo} ${entidadeNome} (${i}/${qtdParcelas})`

      transacoes.push({
        user_id: user.id,
        numero_transacao: numeroTransacao,
        descricao: descricao,
        total: valorParcela,
        tipo: tipoFinanceiro,
        data: prepararDataParaInsert(dataParcela),
        status_pagamento: statusParcela,
        observacao: observacao.trim() || null
      })
    }

    const { error } = await supabase.from('transacoes_loja').insert(transacoes)
    if (error) throw error
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      if (transacaoInicial) {
        await reverterImpactosOld()
      }

      const numTransacao = transacaoInicial?.numero_transacao || (await supabase.rpc('obter_proximo_numero_transacao')).data
      const total = calcularTotal()
      const isVenda = tipo === 'venda' || tipo === 'pedido_venda' || tipo === 'condicional_cliente'

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

        await criarTransacoesParceladas(total, entidade, dataVencimento, quantidadeParcelas, prazoParcelas, 'entrada')

        for (const item of itensValidos) {
          let prodId = item.produto_id

          // Se for novo cadastro, cria o produto primeiro
          if (item.isNovoCadastro && !prodId) {
            const { data: novoProd, error: erroNovoProd } = await supabase
              .from('produtos')
              .insert({
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
            await supabase.rpc('atualizar_estoque', { produto_id_param: prodId, quantidade_param: -item.quantidade })

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

        await criarTransacoesParceladas(total, entidade, dataVencimento, quantidadeParcelas, prazoParcelas, 'saida')

        for (const item of itensValidos) {
          let prodId = item.produto_id

          // Se for novo cadastro, cria o produto primeiro
          if (item.isNovoCadastro && !prodId) {
            const { data: novoProd, error: erroNovoProd } = await supabase
              .from('produtos')
              .insert({
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
            await supabase.rpc('atualizar_estoque', { produto_id_param: prodId, quantidade_param: item.quantidade })

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
        await supabase.from('transacoes_condicionais').update({ status: 'realizado' }).eq('id', idPedidoOrigem)
      }

      alert('✅ Transação gerada com sucesso!')
      clearDraft('loja')
      resetForm()
      onSucesso()
      onClose()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao gerar transação'
      console.error(err)
      setErro(errorMsg)
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      if (transacaoInicial) {
        await reverterImpactosOld()
      }

      const numTransacao = transacaoInicial?.numero_transacao || (await supabase.rpc('obter_proximo_numero_transacao')).data

      const isVendaPedido = tipo === 'venda' || tipo === 'pedido_venda' || tipo === 'condicional_cliente'
      const isPedidoTipo = tipo === 'pedido_venda' || tipo === 'pedido_compra'
      const prefixoPedido = isPedidoTipo ? '[PEDIDO] ' : ''

      let transacaoId = transacaoInicial?.id

      if (transacaoInicial) {
        await supabase.from('transacoes_condicionais').update({
          tipo: isVendaPedido ? 'enviado' : 'recebido',
          origem: entidade,
          data_transacao: prepararDataParaInsert(data),
          observacao: (prefixoPedido + observacao).trim() || null,
          status: 'pendente',
        }).eq('id', transacaoInicial.id)
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
          })
          .select()
          .single()

        if (erroTransacao) throw erroTransacao
        transacaoId = transacao.id
      }

      for (const item of itensValidos) {
        let prodId = item.produto_id

        // Suporte a novo cadastro no condicional também
        if (item.isNovoCadastro && !prodId) {
          const { data: novoProd, error: erroNovoProd } = await supabase
            .from('produtos')
            .insert({
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
          preco_venda: item.preco_venda,
          status: 'pendente',
          observacao: item.observacao_item || null
        }

        const { error: erroIt } = await supabase.from('itens_condicionais').insert(dbItem)
        if (erroIt) throw erroIt
      }

      alert('✅ Pedido/Condicional gerado com sucesso!')
      clearDraft('loja')
      resetForm()
      onSucesso()
      onClose()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao gerar pedido'
      console.error(err)
      setErro(errorMsg)
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
    if (novoTipo === 'venda' || novoTipo === 'compra') {
      buscarPedidosAbertos(novoTipo)
    }
  }

  const buscarPedidosAbertos = async (tipoAtual: string) => {
    try {
      const tipoCond = (tipoAtual === 'venda') ? 'enviado' : 'recebido'
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
    if (!window.confirm(`Deseja importar os itens do Pedido #${pedido.numero_transacao}?`)) return

    setEntidade(pedido.origem)
    setObservacao(pedido.observacao.replace('[PEDIDO]', '').trim())

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
          {!tipo ? (
            <div className="space-y-3">
              <p className="text-center text-gray-600 font-medium mb-4">Selecione o tipo de transação:</p>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => handleTipoSelect('venda')}
                  className="p-3 border-2 border-gray-100 rounded-lg hover:bg-green-50 hover:border-green-500 transition-all flex justify-between items-center group"
                >
                  <span className="font-bold text-gray-700 group-hover:text-green-700">💰 VENDA</span>
                  <span className="text-xs text-gray-400 italic">Direto ao estoque e financeiro</span>
                </button>
                <button
                  onClick={() => handleTipoSelect('compra')}
                  className="p-3 border-2 border-gray-100 rounded-lg hover:bg-purple-50 hover:border-purple-500 transition-all flex justify-between items-center group"
                >
                  <span className="font-bold text-gray-700 group-hover:text-purple-700">📥 COMPRA</span>
                  <span className="text-xs text-gray-400 italic">Entrada de mercadoria</span>
                </button>
                <button
                  onClick={() => handleTipoSelect('pedido_venda')}
                  className="p-3 border rounded-lg hover:bg-yellow-50 hover:border-yellow-500 transition-all flex justify-between items-center group"
                >
                  <span className="font-semibold text-gray-700 group-hover:text-yellow-700">📝 Pedido de Venda</span>
                  <span className="text-xs text-gray-400">Reserva de itens</span>
                </button>
                <button
                  onClick={() => handleTipoSelect('pedido_compra')}
                  className="p-3 border rounded-lg hover:bg-orange-50 hover:border-orange-500 transition-all flex justify-between items-center group"
                >
                  <span className="font-semibold text-gray-700 group-hover:text-orange-700">📦 Pedido de Compra</span>
                  <span className="text-xs text-gray-400">Solicitação ao fornecedor</span>
                </button>
                <button
                  onClick={() => handleTipoSelect('condicional_cliente')}
                  className="p-3 border rounded-lg hover:bg-purple-50 hover:border-purple-500 transition-all flex justify-between items-center group"
                >
                  <span className="font-semibold text-gray-700 group-hover:text-purple-700">✨ Condicional Cliente</span>
                  <span className="text-xs text-gray-400">Envio para teste</span>
                </button>
                <button
                  onClick={() => handleTipoSelect('condicional_fornecedor')}
                  className="p-3 border rounded-lg hover:bg-indigo-50 hover:border-indigo-500 transition-all flex justify-between items-center group"
                >
                  <span className="font-semibold text-gray-700 group-hover:text-indigo-700">🔄 Condicional Fornecedor</span>
                  <span className="text-xs text-gray-400">Recebimento para teste</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
               <div className="flex justify-between items-center bg-purple-50 p-2 rounded border border-purple-100">
                 <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-purple-800 uppercase tracking-tighter">Tipo: {tipo.replace('_', ' ').toUpperCase()}</span>
                    {(tipo === 'venda' || tipo === 'compra') && pedidosAbertos.length > 0 && (
                      <button
                        onClick={() => setMostrarBuscaPedido(!mostrarBuscaPedido)}
                        className="bg-yellow-500 text-white px-2 py-0.5 rounded text-[10px] font-semibold animate-pulse"
                      >
                        {pedidosAbertos.length} PEDIDO(S) EM ABERTO 🔍
                      </button>
                    )}
                 </div>
                 <button onClick={() => setTipo('')} className="text-xs font-bold text-purple-600 hover:underline">ALTERAR TIPO</button>
               </div>

               {mostrarBuscaPedido && (
                 <div className="bg-yellow-50 border border-yellow-200 p-2 rounded space-y-2">
                    <p className="font-bold text-yellow-800 text-[10px] uppercase">Selecione um pedido para importar:</p>
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
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 <div>
                   <label className="block text-xs font-medium text-gray-700 mb-1">Data</label>
                   <input
                     type="date"
                     value={data || ''}
                     onChange={(e) => setData(e.target.value)}
                     className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                   />
                 </div>
                 <div>
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
                             <input
                               type="text"
                               value={item.descricao || ''}
                               onChange={(e) => atualizarItem(item.id, 'descricao', e.target.value)}
                               placeholder="Descrição do novo produto"
                               className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                             />
                           )}

                           <div className="grid grid-cols-3 gap-2">
                             <div>
                               <label className="block text-xs text-gray-600">Categoria</label>
                               {item.isNovoCadastro ? (
                                 <select
                                   value={item.categoria || ''}
                                   onChange={(e) => atualizarItem(item.id, 'categoria', e.target.value)}
                                   className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                 >
                                   <option value="">Selecione...</option>
                                   {categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                                 </select>
                               ) : (
                                 <input type="text" value={item.categoria || ''} disabled className="w-full px-2 py-1 text-xs bg-gray-100 border rounded" />
                               )}
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
                                {(tipo === 'compra' || tipo === 'pedido_compra' || tipo === 'condicional_fornecedor') && !item.isNovoCadastro && (
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
                             <div className="grid grid-cols-2 gap-2">
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

               {/* Informações de Pagamento (Apenas para Transações) */}
               <div className="border-t pt-2 border-gray-100">
                 <h3 className="font-bold text-gray-700 text-xs mb-1 uppercase tracking-tight">Pagamento / Condições</h3>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                   <div>
                     <label className="block text-xs text-gray-600">Vencimento</label>
                     <input type="date" value={dataVencimento || ''} onChange={(e) => setDataVencimento(e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
                   </div>
                   <div>
                     <label className="block text-xs text-gray-600">Parcelas</label>
                     <input type="number" min="1" value={quantidadeParcelas ?? 1} onChange={(e) => setQuantidadeParcelas(parseInt(e.target.value) || 1)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
                   </div>
                   <div>
                     <label className="block text-xs text-gray-600">Prazo</label>
                     <select value={prazoParcelas || 'mensal'} onChange={(e) => setPrazoParcelas(e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded">
                       <option value="diaria">Diária</option>
                       <option value="semanal">Semanal</option>
                       <option value="mensal">Mensal</option>
                     </select>
                   </div>
                   <div>
                     <label className="block text-xs text-gray-600">Status</label>
                     <select value={statusPagamento || 'pendente'} onChange={(e) => setStatusPagamento(e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded">
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

               <div className="bg-purple-100 p-3 rounded flex justify-between items-center border border-purple-200 shadow-sm">
                  <span className="font-semibold text-purple-900 uppercase">TOTAL DA OPERAÇÃO:</span>
                  <span className="text-xl font-semibold text-purple-700">R$ {calcularTotal().toFixed(2)}</span>
               </div>
            </div>
          )}
        </div>

        {/* Rodapé fixo quando tipo selecionado */}
        {tipo && (
          <div className="p-4 border-t bg-gray-50 flex justify-between items-center gap-3">
            <button
              onClick={handleCancelar}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-semibold transition-all flex items-center justify-center uppercase text-[11px]"
            >
              Cancelar
            </button>
            <div className="flex gap-2 items-center">
              <button
                onClick={handleGerarPedido}
                disabled={loading}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white rounded font-semibold transition-all shadow-sm flex items-center justify-center uppercase text-[11px]"
              >
                {loading ? 'Processando...' : transacaoInicial ? 'Salvar Pedido' : 'Gerar Pedido'}
              </button>
              <button
                onClick={handleGerarTransacao}
                disabled={loading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded font-semibold transition-all shadow-sm flex items-center justify-center uppercase text-[11px]"
              >
                {loading ? 'Processando...' : transacaoInicial ? 'Salvar Transação' : 'Gerar Transação'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
