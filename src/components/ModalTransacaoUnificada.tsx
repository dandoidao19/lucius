'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil, prepararDataParaInsert } from '@/lib/dateUtils'
import SeletorProduto from './SeletorProduto'

type TipoTransacao = 'venda' | 'compra' | 'pedido_venda' | 'pedido_compra' | 'condicional_cliente' | 'condicional_fornecedor'

interface ModalTransacaoUnificadaProps {
  aberto: boolean
  onClose: () => void
  onSucesso: () => void
}

export default function ModalTransacaoUnificada({ aberto, onClose, onSucesso }: ModalTransacaoUnificadaProps) {
  const [tipo, setTipo] = useState<TipoTransacao | ''>('')
  const [data, setData] = useState(getDataAtualBrasil())
  const [entidade, setEntidade] = useState('') // Cliente ou Fornecedor
  const [itens, setItens] = useState<any[]>([
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
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(1)
  const [prazoParcelas, setPrazoParcelas] = useState('mensal')
  const [statusPagamento, setStatusPagamento] = useState('pendente')
  const [dataVencimento, setDataVencimento] = useState(getDataAtualBrasil())
  const [categorias, setCategorias] = useState<any[]>([])
  const [resetSeletorKey, setResetSeletorKey] = useState(Date.now())
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (aberto) {
      carregarCategorias()
    }
  }, [aberto])

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

  const atualizarItem = (idItem: string, campo: string, valor: any) => {
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

  const selecionarProduto = (produto: any, idItem: string) => {
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
    tipoFinanceiro: 'entrada' | 'saida',
    numTransacaoOriginal: number
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
      const { data: numTransacao } = await supabase.rpc('obter_proximo_numero_transacao')
      const total = calcularTotal()
      const isVenda = tipo === 'venda' || tipo === 'pedido_venda' || tipo === 'condicional_cliente'

      if (isVenda) {
        // Fluxo de Venda
        const { data: venda, error: erroVenda } = await supabase
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

        await criarTransacoesParceladas(total, entidade, dataVencimento, quantidadeParcelas, prazoParcelas, 'entrada', numTransacao)

        for (const item of itensValidos) {
          if (item.produto_id) {
            await supabase.rpc('atualizar_estoque', { produto_id_param: item.produto_id, quantidade_param: -item.quantidade })
            await supabase.from('itens_venda').insert({ ...item, venda_id: venda.id })
            await supabase.from('movimentacoes_estoque').insert({
              produto_id: item.produto_id,
              tipo: 'saida',
              quantidade: item.quantidade,
              observacao: `Venda #${numTransacao}`
            })
          }
        }
      } else {
        // Fluxo de Compra
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

        await criarTransacoesParceladas(total, entidade, dataVencimento, quantidadeParcelas, prazoParcelas, 'saida', numTransacao)

        for (const item of itensValidos) {
          if (item.produto_id) {
            await supabase.rpc('atualizar_estoque', { produto_id_param: item.produto_id, quantidade_param: item.quantidade })
            await supabase.from('itens_compra').insert({ ...item, compra_id: compra.id })
            await supabase.from('movimentacoes_estoque').insert({
              produto_id: item.produto_id,
              tipo: 'entrada',
              quantidade: item.quantidade,
              observacao: `Compra #${numTransacao}`
            })
          }
        }
      }

      alert('✅ Transação gerada com sucesso!')
      onSucesso()
      handleFechar()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || 'Erro ao gerar transação')
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
      const { data: ultimaTransacao } = await supabase
        .from('transacoes_condicionais')
        .select('numero_transacao')
        .order('numero_transacao', { ascending: false })
        .limit(1)
        .single()

      const proximoNumero = (ultimaTransacao?.numero_transacao || 0) + 1
      const isVendaPedido = tipo === 'venda' || tipo === 'pedido_venda' || tipo === 'condicional_cliente'
      const isPedidoTipo = tipo === 'pedido_venda' || tipo === 'pedido_compra'
      const prefixoPedido = isPedidoTipo ? '[PEDIDO] ' : ''

      const { data: transacao, error: erroTransacao } = await supabase
        .from('transacoes_condicionais')
        .insert({
          numero_transacao: proximoNumero,
          tipo: isVendaPedido ? 'enviado' : 'recebido',
          origem: entidade,
          data_transacao: prepararDataParaInsert(data),
          observacao: (prefixoPedido + observacao).trim() || null,
          status: 'pendente',
        })
        .select()
        .single()

      if (erroTransacao) throw erroTransacao

      for (const item of itensValidos) {
        await supabase
          .from('itens_condicionais')
          .insert({
            transacao_id: transacao.id,
            produto_id: item.produto_id,
            descricao: item.descricao,
            quantidade: item.quantidade,
            categoria: item.categoria,
            preco_custo: item.preco_custo,
            preco_venda: item.preco_venda,
            status: 'pendente',
          })
      }

      alert('✅ Pedido/Condicional gerado com sucesso!')
      onSucesso()
      handleFechar()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || 'Erro ao gerar pedido')
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
  }

  const handleFechar = () => {
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
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg shadow-xl w-full max-h-[90vh] overflow-hidden flex flex-col transition-all ${tipo ? 'max-w-4xl' : 'max-w-md'}`}>
        {/* Cabeçalho */}
        <div className="bg-blue-600 px-4 py-3 flex justify-between items-center text-white">
          <h2 className="font-bold">Lançar Nova Transação</h2>
          <button onClick={handleFechar} className="hover:bg-blue-700 p-1 rounded">✕</button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {!tipo ? (
            <div className="space-y-3">
              <p className="text-center text-gray-600 font-medium mb-4">Selecione o tipo de transação:</p>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => handleTipoSelect('venda')}
                  className="p-3 border rounded-lg hover:bg-green-50 hover:border-green-500 transition-all flex justify-between items-center group"
                >
                  <span className="font-semibold text-gray-700 group-hover:text-green-700">💰 Venda</span>
                  <span className="text-xs text-gray-400">Direto ao estoque e financeiro</span>
                </button>
                <button
                  onClick={() => handleTipoSelect('compra')}
                  className="p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-500 transition-all flex justify-between items-center group"
                >
                  <span className="font-semibold text-gray-700 group-hover:text-blue-700">📥 Compra</span>
                  <span className="text-xs text-gray-400">Entrada de mercadoria</span>
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
               <div className="flex justify-between items-center bg-gray-50 p-2 rounded border">
                 <span className="text-sm font-bold text-gray-700">Tipo: {tipo.replace('_', ' ').toUpperCase()}</span>
                 <button onClick={() => setTipo('')} className="text-xs text-blue-600 hover:underline">Alterar Tipo</button>
               </div>

               {/* Data e Entidade */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 <div>
                   <label className="block text-xs font-medium text-gray-700 mb-1">Data</label>
                   <input
                     type="date"
                     value={data}
                     onChange={(e) => setData(e.target.value)}
                     className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-medium text-gray-700 mb-1">
                     {(tipo === 'compra' || tipo === 'pedido_compra' || tipo === 'condicional_fornecedor') ? 'Fornecedor' : 'Cliente'} *
                   </label>
                   <input
                     type="text"
                     value={entidade}
                     onChange={(e) => setEntidade(e.target.value)}
                     placeholder={`Nome do ${(tipo === 'compra' || tipo === 'pedido_compra' || tipo === 'condicional_fornecedor') ? 'fornecedor' : 'cliente'}`}
                     className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                     required
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
                     <div key={item.id} className={`border rounded p-2 ${item.minimizado ? 'bg-gray-50' : 'bg-blue-50 border-blue-200'}`}>
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
                               <span className="text-[10px] font-medium">Novo Cadastro</span>
                             </label>
                           </div>

                           {!item.isNovoCadastro ? (
                             <SeletorProduto
                               key={`seletor-${resetSeletorKey}-${item.id}`}
                               onSelecionarProduto={(p) => selecionarProduto(p, item.id)}
                               placeholder="Buscar produto..."
                             />
                           ) : (
                             <input
                               type="text"
                               value={item.descricao}
                               onChange={(e) => atualizarItem(item.id, 'descricao', e.target.value)}
                               placeholder="Descrição do novo produto"
                               className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                             />
                           )}

                           <div className="grid grid-cols-3 gap-2">
                             <div>
                               <label className="block text-[9px] text-gray-600">Categoria</label>
                               {item.isNovoCadastro ? (
                                 <select
                                   value={item.categoria}
                                   onChange={(e) => atualizarItem(item.id, 'categoria', e.target.value)}
                                   className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                 >
                                   <option value="">Selecione...</option>
                                   {categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                                 </select>
                               ) : (
                                 <input type="text" value={item.categoria} disabled className="w-full px-2 py-1 text-xs bg-gray-100 border rounded" />
                               )}
                             </div>
                             <div>
                               <label className="block text-[9px] text-gray-600">Quantidade</label>
                               <input
                                 type="number"
                                 value={item.quantidade}
                                 onChange={(e) => atualizarItem(item.id, 'quantidade', parseInt(e.target.value) || 0)}
                                 className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                               />
                             </div>
                             <div>
                               <label className="block text-[9px] text-gray-600">Preço</label>
                              <div className="flex gap-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={tipo === 'compra' || tipo === 'pedido_compra' || tipo === 'condicional_fornecedor' ? item.preco_custo : item.preco_venda}
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
                                  <label className="block text-[9px] text-gray-600">Valor Repasse (Calc.)</label>
                                  <input type="text" value={`R$ ${(item.valor_repasse || 0).toFixed(2)}`} disabled className="w-full px-2 py-1 text-xs bg-gray-100 border rounded" />
                                </div>
                                <div>
                                  <label className="block text-[9px] text-gray-600">Preço Venda Sugerido</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={item.preco_venda}
                                    onChange={(e) => atualizarItem(item.id, 'preco_venda', parseFloat(e.target.value) || 0)}
                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                  />
                                </div>
                             </div>
                           )}

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
               <div className="border-t pt-2">
                 <h3 className="font-semibold text-gray-700 text-xs mb-2">Pagamento / Condições</h3>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                   <div>
                     <label className="block text-[9px] text-gray-600">Vencimento</label>
                     <input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
                   </div>
                   <div>
                     <label className="block text-[9px] text-gray-600">Parcelas</label>
                     <input type="number" min="1" value={quantidadeParcelas} onChange={(e) => setQuantidadeParcelas(parseInt(e.target.value) || 1)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
                   </div>
                   <div>
                     <label className="block text-[9px] text-gray-600">Prazo</label>
                     <select value={prazoParcelas} onChange={(e) => setPrazoParcelas(e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded">
                       <option value="diaria">Diária</option>
                       <option value="semanal">Semanal</option>
                       <option value="mensal">Mensal</option>
                     </select>
                   </div>
                   <div>
                     <label className="block text-[9px] text-gray-600">Status</label>
                     <select value={statusPagamento} onChange={(e) => setStatusPagamento(e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded">
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
                   value={observacao}
                   onChange={(e) => setObservacao(e.target.value)}
                   placeholder="Notas adicionais sobre esta operação..."
                   className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                   rows={2}
                 />
               </div>

               <div className="bg-gray-100 p-3 rounded flex justify-between items-center">
                  <span className="font-bold text-gray-700">TOTAL DA OPERAÇÃO:</span>
                  <span className="text-xl font-black text-blue-700">R$ {calcularTotal().toFixed(2)}</span>
               </div>
            </div>
          )}
        </div>

        {/* Rodapé fixo quando tipo selecionado */}
        {tipo && (
          <div className="p-4 border-t bg-gray-50 flex justify-between gap-3">
            <button
              onClick={handleFechar}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-bold transition-all"
            >
              Cancelar
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleGerarPedido}
                disabled={loading}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white rounded font-bold transition-all shadow-sm"
              >
                {loading ? 'Processando...' : 'Gerar Pedido'}
              </button>
              <button
                onClick={handleGerarTransacao}
                disabled={loading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded font-bold transition-all shadow-sm"
              >
                {loading ? 'Processando...' : 'Gerar Transação'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
