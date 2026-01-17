'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil, prepararDataParaInsert } from '@/lib/dateUtils'
import SeletorProduto from './SeletorProduto'

interface ItemCompra {
  id: string
  produto_id: string | null
  descricao: string
  quantidade: number
  categoria: string
  preco_custo: number
  valor_repasse: number
  preco_venda: number
  minimizado?: boolean
  isNovoCadastro?: boolean
}

interface FormularioCompraProps {
  onCompraAdicionada: () => void
}

// Função corrigida para garantir intervalo correto
const getDataNDias = (dataBase: string, dias: number) => {
  const data = new Date(dataBase + 'T12:00:00') // Adicionar meio-dia para evitar problema de fuso
  data.setDate(data.getDate() + dias)
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

const addMonths = (dateString: string, months: number): string => {
  const [ano, mes, dia] = dateString.split('-').map(Number)
  const date = new Date(ano, mes - 1 + months, dia)

  if (date.getDate() !== dia) {
    date.setDate(0)
  }

  const novoAno = date.getFullYear()
  const novoMes = String(date.getMonth() + 1).padStart(2, '0')
  const novoDia = String(date.getDate()).padStart(2, '0')

  return `${novoAno}-${novoMes}-${novoDia}`
}

export default function FormularioCompra({ onCompraAdicionada }: FormularioCompraProps) {
  const [dataCompra, setDataCompra] = useState(getDataAtualBrasil())
  const [fornecedor, setFornecedor] = useState('')
  const [itens, setItens] = useState<ItemCompra[]>([
    {
      id: Date.now().toString(),
      produto_id: null,
      descricao: '',
      quantidade: 1,
      categoria: '',
      preco_custo: 0,
      valor_repasse: 0,
      preco_venda: 0,
      minimizado: false,
      isNovoCadastro: false,
    },
  ])
  const [categorias, setCategorias] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [quantidadeParcelas, setQuantidadeParcelas] = useState(1)
  const [prazoParcelas, setPrazoParcelas] = useState('mensal')
  const [statusPagamento, setStatusPagamento] = useState('pendente')
  const [dataVencimento, setDataVencimento] = useState(getDataAtualBrasil())

  useEffect(() => {
    carregarCategorias()
  }, [])

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
    return itens.reduce((total, item) => total + item.quantidade * item.valor_repasse, 0)
  }

  const adicionarNovoItem = () => {
    setItens((prev) =>
      prev.map((item, idx) => 
        idx === prev.length - 1 ? { ...item, minimizado: true } : item
      )
    )

    // Resetar completamente o novo item
    setItens((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        produto_id: null,
        descricao: '',
        quantidade: 1,
        categoria: categorias[0]?.nome || '',
        preco_custo: 0,
        valor_repasse: 0,
        preco_venda: 0,
        minimizado: false,
        isNovoCadastro: false,
      },
    ])
  }

  const removerItem = (idItem: string) => {
    if (itens.length > 1) {
      setItens(itens.filter((item) => item.id !== idItem))
    } else {
      alert('Você deve ter pelo menos um item')
    }
    setErro('')
  }

  const ativarItemParaEdicao = (idItem: string) => {
    const itemSelecionado = itens.find(item => item.id === idItem)
    if (!itemSelecionado) return

    const outrosItens = itens.filter(item => item.id !== idItem)

    // Garante que todos os outros itens fiquem minimizados
    const outrosItensMinimizados = outrosItens.map(item =>
      item.minimizado ? item : { ...item, minimizado: true }
    )

    // Coloca o item selecionado no final, como ativo
    const novosItens = [...outrosItensMinimizados.filter(item => !item.minimizado), ...outrosItensMinimizados.filter(item => item.minimizado), { ...itemSelecionado, minimizado: false }]

    setItens(novosItens)
  }

  const atualizarItem = (idItem: string, campo: string, valor: any) => {
    setItens(prevItens => {
      const novosItens = prevItens.map(item => {
        if (item.id === idItem) {
          const itemAtualizado = { ...item, [campo]: valor }

          // Recalcular valor_repasse se o preço de custo ou a categoria mudar
          if (campo === 'preco_custo' || campo === 'categoria') {
            const categoriaNome = campo === 'categoria' ? valor : itemAtualizado.categoria
            const precoCusto = campo === 'preco_custo' ? parseFloat(valor) || 0 : itemAtualizado.preco_custo

            const categoriaSelecionada = categorias.find(cat => cat.nome === categoriaNome)

            if (categoriaSelecionada && precoCusto > 0) {
              const percentual = categoriaSelecionada.percentual_repasse || 0
              itemAtualizado.valor_repasse = precoCusto * (1 + percentual / 100)
            } else {
              itemAtualizado.valor_repasse = precoCusto // Se não houver percentual, repasse é igual ao custo
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
            }
          : item
      )
    )
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

    setItens(prevItens =>
      prevItens.map(item =>
        item.id === idItem
          ? {
              ...item,
              produto_id: produto.id,
              descricao: produto.descricao || '',
              preco_custo: precoCusto,
              valor_repasse: valorRepasse,
              preco_venda: produto.preco_venda || 0,
              categoria: categoriaNome,
            }
          : item
      )
    )
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

  const criarTransacoesParceladas = async (
    compraId: string,
    total: number,
    fornecedor: string,
    dataVencimento: string,
    quantidadeParcelas: number,
    prazoParcelas: string,
    numeroTransacaoCompra: number
  ) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    console.log('📅 Data de vencimento recebida:', dataVencimento)
    console.log('💰 Valor total:', total)
    console.log('📊 Quantidade de parcelas:', quantidadeParcelas)

    const valorParcela = total / quantidadeParcelas
    const transacoes = []

    for (let i = 1; i <= quantidadeParcelas; i++) {
      let dataParcela = dataVencimento
      
      console.log(`📅 Calculando parcela ${i}/${quantidadeParcelas}`)
      console.log(`📅 Data base: ${dataVencimento}`)
      
      if (i > 1) {
        if (prazoParcelas === 'diaria') {
          dataParcela = getDataNDias(dataVencimento, i - 1)
          console.log(`📅 Parcela ${i} (diária): ${dataParcela}`)
        } else if (prazoParcelas === 'semanal') {
          dataParcela = getDataNDias(dataVencimento, (i - 1) * 7)
          console.log(`📅 Parcela ${i} (semanal): ${dataParcela}`)
        } else if (prazoParcelas === 'mensal') {
          dataParcela = addMonths(dataVencimento, i - 1)
          console.log(`📅 Parcela ${i} (mensal): ${dataParcela}`)
        }
      }

      const dataParcelaFormatada = prepararDataParaInsert(dataParcela)
      console.log(`📅 Parcela ${i} formatada: ${dataParcelaFormatada}`)

      let statusParcela = 'pendente'
      if (statusPagamento === 'pago') {
        statusParcela = 'pago'
      } else if (statusPagamento === 'parcial' && i === 1) {
        statusParcela = 'pago'
      }

      // Usar número aleatório para cada transação
      const numeroTransacao = Math.floor(100000 + Math.random() * 900000) + i

      // Descrição com número da transação para identificar unicamente
      const descricao = `Compra #${numeroTransacaoCompra} ${fornecedor} (${i}/${quantidadeParcelas})`

      transacoes.push({
        user_id: user.id,
        numero_transacao: numeroTransacao,
        descricao: descricao,
        total: valorParcela,
        tipo: 'saida',
        data: dataParcelaFormatada,
        status_pagamento: statusParcela
      })
    }

    console.log('📊 Transações a serem criadas:', transacoes)

    // Limpar APENAS as transações desta compra específica
    const { data: transacoesExistentes } = await supabase
      .from('transacoes_loja')
      .select('id')
      .ilike('descricao', `%Compra #${numeroTransacaoCompra} ${fornecedor}%`)
      .eq('tipo', 'saida')

    if (transacoesExistentes && transacoesExistentes.length > 0) {
      console.log(`🗑️ Encontradas ${transacoesExistentes.length} transações antigas para limpar`)
      const { error: deleteError } = await supabase
        .from('transacoes_loja')
        .delete()
        .ilike('descricao', `%Compra #${numeroTransacaoCompra} ${fornecedor}%`)
        .eq('tipo', 'saida')

      if (deleteError) {
        console.error('Erro ao limpar transações desta compra:', deleteError)
      }
    }

    const { error } = await supabase
      .from('transacoes_loja')
      .insert(transacoes)

    if (error) {
      console.error('Erro ao criar transações parceladas:', error)
      throw error
    }
    
    console.log('✅ Transações criadas com sucesso')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      const itensValidos = itens.filter(item => item.descricao && item.descricao.trim() !== '')

      if (itensValidos.length === 0) {
        throw new Error('Adicione pelo menos um item à compra.')
      }

      if (!fornecedor.trim()) {
        throw new Error('Fornecedor é obrigatório')
      }

      for (const item of itensValidos) {
        if (item.quantidade <= 0) {
          throw new Error('Quantidade deve ser maior que 0')
        }
        if (item.preco_custo <= 0) {
          throw new Error('Preço de custo deve ser maior que 0')
        }
        if (item.preco_venda <= 0) {
          throw new Error('Preço de venda deve ser maior que 0')
        }
      }

      const { data: numeroTransacao } = await supabase
        .rpc('obter_proximo_numero_transacao')

      const dataCompraPrepara = prepararDataParaInsert(dataCompra)
      const dataVencimentoPrepara = prepararDataParaInsert(dataVencimento)

      console.log('📋 Dados da compra:')
      console.log('📅 Data da compra:', dataCompraPrepara)
      console.log('📅 Data de vencimento:', dataVencimentoPrepara)
      console.log('💰 Total:', calcularTotal())
      console.log('📊 Parcelas:', quantidadeParcelas)
      console.log('📅 Prazo:', prazoParcelas)

      const totalCompra = itensValidos.reduce((total, item) => total + item.quantidade * item.valor_repasse, 0)

      const dadosCompra: any = {
        numero_transacao: numeroTransacao,
        data_compra: dataCompraPrepara,
        fornecedor,
        total: totalCompra,
        quantidade_itens: itensValidos.length,
        forma_pagamento: 'dinheiro',
        status_pagamento: statusPagamento,
        quantidade_parcelas: quantidadeParcelas,
        prazoparcelas: prazoParcelas,
      }

      const { data: compraData, error: erroCompra } = await supabase
        .from('compras')
        .insert(dadosCompra)
        .select()
        .single()

      if (erroCompra) {
        if (erroCompra.message.includes('data_vencimento') || erroCompra.code === '42703') {
          const { data: compraData2, error: erroCompra2 } = await supabase
            .from('compras')
            .insert({
              numero_transacao: numeroTransacao,
              data_compra: dataCompraPrepara,
              fornecedor,
              total: totalCompra,
              quantidade_itens: itensValidos.length,
              forma_pagamento: 'dinheiro',
              status_pagamento: statusPagamento,
              quantidade_parcelas: quantidadeParcelas,
              prazoparcelas: prazoParcelas,
            })
            .select()
            .single()

          if (erroCompra2) {
            throw erroCompra2
          }
          
          console.log('🔄 Criando transações parceladas...')
          await criarTransacoesParceladas(
            compraData2.id,
            totalCompra,
            fornecedor,
            dataVencimentoPrepara,
            quantidadeParcelas,
            prazoParcelas,
            numeroTransacao
          )

          for (const item of itensValidos) {
            let produtoId = item.produto_id

            if (!produtoId) {
              const { data: novoProduto, error: erroNovoProduto } = await supabase
                .from('produtos')
                .insert({
                  codigo: `${item.categoria.substring(0, 1).toUpperCase()}${Math.floor(Math.random() * 10000)}`,
                  descricao: item.descricao,
                  quantidade: item.quantidade,
                  preco_custo: item.preco_custo,
                  valor_repasse: item.valor_repasse,
                  preco_venda: item.preco_venda,
                  categoria: item.categoria,
                  data_ultima_compra: dataCompraPrepara,
                })
                .select()
                .single()

              if (erroNovoProduto) {
                throw erroNovoProduto
              }
              produtoId = novoProduto.id
            } else {
              const { data: produtoAtual } = await supabase
                .from('produtos')
                .select('quantidade')
                .eq('id', produtoId)
                .single()

              if (produtoAtual) {
                const { error: erroUpdate } = await supabase
                  .from('produtos')
                  .update({
                    quantidade: produtoAtual.quantidade + item.quantidade,
                    preco_custo: item.preco_custo,
                    valor_repasse: item.valor_repasse,
                    preco_venda: item.preco_venda,
                    categoria: item.categoria,
                    data_ultima_compra: dataCompraPrepara,
                  })
                  .eq('id', produtoId)

                if (erroUpdate) {
                  throw erroUpdate
                }
              }
            }

            const { error: erroItem } = await supabase
              .from('itens_compra')
              .insert({
                compra_id: compraData2.id,
                produto_id: produtoId,
                descricao: item.descricao,
                quantidade: item.quantidade,
                categoria: item.categoria,
                preco_custo: item.preco_custo,
                valor_repasse: item.valor_repasse,
                preco_venda: item.preco_venda,
              })

            if (erroItem) {
              throw erroItem
            }

            await supabase
              .from('movimentacoes_estoque')
              .insert({
                produto_id: produtoId,
                tipo: 'entrada',
                quantidade: item.quantidade,
                observacao: `Compra de ${item.descricao} de ${fornecedor}. Valor Repasse: R$ ${item.valor_repasse.toFixed(2)}`,
                data: new Date().toISOString(),
              })
          }

          // Resetar formulário após sucesso
          setDataCompra(getDataAtualBrasil())
          setFornecedor('')
          setItens([
            {
              id: Date.now().toString(),
              produto_id: null,
              descricao: '',
              quantidade: 1,
              categoria: categorias[0]?.nome || '',
              preco_custo: 0,
              valor_repasse: 0,
              preco_venda: 0,
              minimizado: false,
              isNovoCadastro: false,
            },
          ])
          setQuantidadeParcelas(1)
          setPrazoParcelas('mensal')
          setStatusPagamento('pendente')
          setDataVencimento(getDataAtualBrasil())

          onCompraAdicionada()
          setLoading(false)
          return
        } else {
          throw erroCompra
        }
      }

      console.log('🔄 Criando transações parceladas...')
      await criarTransacoesParceladas(
        compraData.id,
        totalCompra,
        fornecedor,
        dataVencimentoPrepara,
        quantidadeParcelas,
        prazoParcelas,
        numeroTransacao
      )

      for (const item of itensValidos) {
        let produtoId = item.produto_id

        if (!produtoId) {
          const { data: novoProduto, error: erroNovoProduto } = await supabase
            .from('produtos')
            .insert({
              codigo: `${item.categoria.substring(0, 1).toUpperCase()}${Math.floor(Math.random() * 10000)}`,
              descricao: item.descricao,
              quantidade: item.quantidade,
              preco_custo: item.preco_custo,
              valor_repasse: item.valor_repasse,
              preco_venda: item.preco_venda,
              categoria: item.categoria,
              data_ultima_compra: dataCompraPrepara,
            })
            .select()
            .single()

          if (erroNovoProduto) {
            throw erroNovoProduto
          }
          produtoId = novoProduto.id
        } else {
          const { data: produtoAtual } = await supabase
            .from('produtos')
            .select('quantidade')
            .eq('id', produtoId)
            .single()

          if (produtoAtual) {
            const { error: erroUpdate } = await supabase
              .from('produtos')
              .update({
                quantidade: produtoAtual.quantidade + item.quantidade,
                preco_custo: item.preco_custo,
                valor_repasse: item.valor_repasse,
                preco_venda: item.preco_venda,
                categoria: item.categoria,
                data_ultima_compra: dataCompraPrepara,
              })
              .eq('id', produtoId)

            if (erroUpdate) {
              throw erroUpdate
            }
          }
        }

        const { error: erroItem } = await supabase
          .from('itens_compra')
          .insert({
            compra_id: compraData.id,
            produto_id: produtoId,
            descricao: item.descricao,
            quantidade: item.quantidade,
            categoria: item.categoria,
            preco_custo: item.preco_custo,
            valor_repasse: item.valor_repasse,
            preco_venda: item.preco_venda,
          })

        if (erroItem) {
          throw erroItem
        }

        await supabase
          .from('movimentacoes_estoque')
          .insert({
            produto_id: produtoId,
            tipo: 'entrada',
            quantidade: item.quantidade,
            observacao: `Compra de ${item.descricao} de ${fornecedor}. Valor Repasse: R$ ${item.valor_repasse.toFixed(2)}`,
            data: new Date().toISOString(),
          })
      }

      // Resetar formulário após sucesso
      setDataCompra(getDataAtualBrasil())
      setFornecedor('')
      setItens([
        {
          id: Date.now().toString(),
          produto_id: null,
          descricao: '',
          quantidade: 1,
          categoria: categorias[0]?.nome || '',
          preco_custo: 0,
          valor_repasse: 0,
          preco_venda: 0,
          minimizado: false,
          isNovoCadastro: false,
        },
      ])
      setQuantidadeParcelas(1)
      setPrazoParcelas('mensal')
      setStatusPagamento('pendente')
      setDataVencimento(getDataAtualBrasil())

      onCompraAdicionada()
    } catch (err) {
      console.error('❌ Erro completo:', err)
      setErro(err instanceof Error ? err.message : 'Erro ao registrar compra')
    } finally {
      setLoading(false)
    }
  }

  const itemAtivo = itens[itens.length - 1]

  return (
    <div className="bg-white rounded-lg shadow-md p-3 space-y-2">
      <h2 className="text-sm font-semibold text-gray-800 mb-2">Nova Compra</h2>

      {erro && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded text-xs">
          {erro}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        {/* Data da Compra e Fornecedor */}
        <div className="grid grid-cols-2 gap-1">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Data da Compra
            </label>
            <input
              type="date"
              value={dataCompra}
              onChange={(e) => setDataCompra(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Fornecedor *
            </label>
            <input
              type="text"
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
              placeholder="Nome do fornecedor"
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        {/* Itens Minimizados */}
        {itens.filter((i) => i.minimizado).length > 0 && (
          <div className="border-t pt-2">
            <h3 className="font-semibold text-gray-700 mb-2 text-xs">
              Itens Adicionados ({itens.filter((i) => i.minimizado).length})
            </h3>
            <div className="space-y-1">
              {itens
                .filter((i) => i.minimizado)
                .map((item) => (
                  <div
                    key={item.id}
                    className="bg-gray-50 p-1 rounded border border-gray-200 flex justify-between items-center"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 text-xs">{item.descricao}</p>
                      <p className="text-xs text-gray-600">
                        {item.quantidade}x R$ {item.valor_repasse.toFixed(2)} = R${' '}
                        {(item.quantidade * item.valor_repasse).toFixed(2)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removerItem(item.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium ml-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Item Ativo (em edição) */}
        {itemAtivo && (
          <div className="border-t pt-2 bg-blue-50 p-2 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-800 text-xs">
                  Item {itens.length} (Em Preenchimento)
                </h3>
                {itens.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removerItem(itemAtivo.id)}
                    className="text-red-500 hover:text-red-700 text-xs font-medium"
                  >
                    (Remover este item)
                  </button>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={itemAtivo.isNovoCadastro || false}
                  onChange={() => toggleNovoCadastro(itemAtivo.id)}
                  className="w-3 h-3 rounded border-gray-300"
                />
                <span className="text-xs font-medium text-gray-700">Novo Cadastro</span>
              </label>
            </div>

            <div className="space-y-2">
              {/* Campo Produto - Muda conforme modo */}
              {!itemAtivo.isNovoCadastro ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Produto (Busca e Seleção)
                  </label>
                  <SeletorProduto
                    onSelecionarProduto={(produto) => selecionarProduto(produto, itemAtivo.id)}
                    onNovoItem={() => {}}
                    placeholder="Buscar ou criar..."
                    descricaoPreenchida=""
                    key={`seletor-${itemAtivo.id}`}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Descrição do Produto *
                  </label>
                  <input
                    type="text"
                    value={itemAtivo.descricao}
                    onChange={(e) => atualizarItem(itemAtivo.id, 'descricao', e.target.value)}
                    placeholder="Nome do novo produto"
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}

              {/* Campo Categoria - Muda conforme modo */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Categoria *
                </label>
                {!itemAtivo.isNovoCadastro ? (
                  <input
                    type="text"
                    value={itemAtivo.categoria}
                    disabled
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
                  />
                ) : (
                  <select
                    value={itemAtivo.categoria}
                    onChange={(e) => atualizarItem(itemAtivo.id, 'categoria', e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Selecione uma categoria</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.nome}>
                        {cat.nome}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Quantidade */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Quantidade *
                </label>
                <input
                  type="number"
                  value={itemAtivo.quantidade}
                  onChange={(e) =>
                    atualizarItem(itemAtivo.id, 'quantidade', parseInt(e.target.value) || 0)
                  }
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Preço de Custo - Muda conforme modo */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Preço de Custo *
                </label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    step="0.01"
                    value={itemAtivo.preco_custo}
                    onChange={(e) =>
                      atualizarItem(itemAtivo.id, 'preco_custo', parseFloat(e.target.value) || 0)
                    }
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  {!itemAtivo.isNovoCadastro && (
                    <button
                      type="button"
                      onClick={() => buscarUltimoPrecoCusto(itemAtivo.descricao, itemAtivo.id)}
                      className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium"
                    >
                      Buscar
                    </button>
                  )}
                </div>
              </div>

              {/* Valor Repasse */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Valor Repasse (Calculado)
                </label>
                <input
                  type="text"
                  value={`R$ ${itemAtivo.valor_repasse.toFixed(2)}`}
                  disabled
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
                />
              </div>

              {/* Preço de Venda */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Preço de Venda *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={itemAtivo.preco_venda}
                  onChange={(e) =>
                    atualizarItem(itemAtivo.id, 'preco_venda', parseFloat(e.target.value) || 0)
                  }
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Informações de Pagamento */}
              <div className="border-t pt-2 mt-2">
                <h4 className="font-semibold text-gray-800 mb-2 text-xs">Informações de Pagamento</h4>
                <div className="grid grid-cols-2 gap-1 mb-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Data de Vencimento *
                    </label>
                    <input
                      type="date"
                      value={dataVencimento}
                      onChange={(e) => setDataVencimento(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Parcelas
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={quantidadeParcelas}
                      onChange={(e) => setQuantidadeParcelas(parseInt(e.target.value) || 1)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Prazo
                    </label>
                    <select
                      value={prazoParcelas}
                      onChange={(e) => setPrazoParcelas(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="diaria">Diária</option>
                      <option value="semanal">Semanal</option>
                      <option value="mensal">Mensal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={statusPagamento}
                      onChange={(e) => setStatusPagamento(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="pago">Pago</option>
                      <option value="parcial">Parcial</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Botão Adicionar Novo Item */}
              <button
                type="button"
                onClick={adicionarNovoItem}
                className="w-full mt-2 bg-green-500 hover:bg-green-600 text-white py-1 rounded-lg font-medium text-xs transition-colors"
              >
                + Adicionar Outro Item
              </button>
            </div>
          </div>
        )}

        {/* Total */}
        <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-800">Total:</span>
            <span className="text-xl font-bold text-blue-600">
              R$ {calcularTotal().toFixed(2)}
            </span>
          </div>
        </div>

        {/* Botão Registrar */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-1.5 rounded-lg font-semibold text-xs transition-colors"
        >
          {loading ? 'Registrando...' : 'Registrar Compra'}
        </button>
      </form>
    </div>
  )
}