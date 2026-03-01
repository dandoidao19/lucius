'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'
import ModalEditarProduto from './ModalEditarProduto'
import ModalLogProduto from './ModalLogProduto'
import { GeradorPDFProfissional, obterConfigLogos } from '@/lib/gerador-pdf-utils'
import { formatarDataParaExibicao } from '@/lib/dateUtils'

interface Produto {
  id: string
  codigo: string
  descricao: string
  quantidade: number
  quantidade_condicional?: number
  preco_custo: number
  valor_repasse: number
  preco_venda: number
  data_ultima_compra: string
  status_item?: string
  categoria?: string
}

type OrdenacaoTipo = 'descricao' | 'preco_venda' | 'categoria' | 'quantidade'
type OrdenacaoDirecao = 'asc' | 'desc'

export default function LojaPaginaEstoque() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [produtosFiltrados, setProdutosFiltrados] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [modalEditarAberto, setModalEditarAberto] = useState(false)
  const [modalLogAberto, setModalLogAberto] = useState(false)
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null)
  const { versaoRefresh } = useDadosFinanceiros()
  
  // Estados de filtro
  const [filtroAberto, setFiltroAberto] = useState(false)
  const [filtroDescricao, setFiltroDescricao] = useState('')
  const [filtroCodigo, setFiltroCodigo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'resolvido' | 'condicional'>('todos')
  
  // Estados de ordenação
  const [ordenacaoPor, setOrdenacaoPor] = useState<OrdenacaoTipo>('descricao')
  const [ordenacaoDirecao, setOrdenacaoDirecao] = useState<OrdenacaoDirecao>('asc')

  const carregarProdutos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('descricao', { ascending: true })

      if (error) throw error
      setProdutos(data || [])
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const aplicarFiltrosEOrdenacao = useCallback(() => {
    let resultado = [...produtos]

    // Aplicar prioridade de ordenação: saldo positivo → negativo → zerado
    resultado.sort((a, b) => {
      const qtdA = (a.quantidade || 0)
      const qtdB = (b.quantidade || 0)

      // Positivo vem primeiro
      if (qtdA > 0 && qtdB <= 0) return -1
      if (qtdA <= 0 && qtdB > 0) return 1

      // Negativo vem antes de zerado
      if (qtdA < 0 && qtdB === 0) return -1
      if (qtdA === 0 && qtdB < 0) return 1

      return 0
    })

    if (filtroDescricao) {
      resultado = resultado.filter(p => 
        p.descricao.toLowerCase().includes(filtroDescricao.toLowerCase())
      )
    }

    if (filtroCodigo) {
      resultado = resultado.filter(p => 
        p.codigo.toLowerCase().includes(filtroCodigo.toLowerCase())
      )
    }

    if (filtroStatus !== 'todos') {
      resultado = resultado.filter(p => 
        (p.status_item || 'resolvido') === filtroStatus
      )
    }

    // Aplicar ordenação adicional
    resultado.sort((a, b) => {
      let comparacao = 0

      switch (ordenacaoPor) {
        case 'descricao':
          comparacao = a.descricao.localeCompare(b.descricao)
          break
        case 'preco_venda':
          comparacao = (a.preco_venda || 0) - (b.preco_venda || 0)
          break
        case 'categoria':
          comparacao = (a.categoria || '').localeCompare(b.categoria || '')
          break
        case 'quantidade':
          comparacao = (a.quantidade || 0) - (b.quantidade || 0)
          break
      }

      return ordenacaoDirecao === 'asc' ? comparacao : -comparacao
    })

    setProdutosFiltrados(resultado)
  }, [produtos, filtroDescricao, filtroCodigo, filtroStatus, ordenacaoPor, ordenacaoDirecao])

  useEffect(() => {
    carregarProdutos()
  }, [carregarProdutos, versaoRefresh])

  useEffect(() => {
    aplicarFiltrosEOrdenacao()
  }, [aplicarFiltrosEOrdenacao])

  // Funções para calcular os novos valores do estoque
  const calcularValorRealizadoVenda = () => {
    return produtosFiltrados.reduce((total, produto) => {
      if ((produto.status_item || 'resolvido') === 'resolvido') {
        const preco = produto.preco_venda || 0
        return total + (produto.quantidade || 0) * preco
      }
      return total
    }, 0)
  }

  const calcularValorRealizadoRepasse = () => {
    return produtosFiltrados.reduce((total, produto) => {
      if ((produto.status_item || 'resolvido') === 'resolvido') {
        const repasse = produto.valor_repasse || 0
        return total + (produto.quantidade || 0) * repasse
      }
      return total
    }, 0)
  }

  const calcularValorCondicionalVenda = () => {
    return produtosFiltrados.reduce((total, produto) => {
      if ((produto.status_item || 'resolvido') === 'condicional') {
        const preco = produto.preco_venda || 0
        const qtdCondicional = produto.quantidade_condicional || produto.quantidade || 0
        return total + qtdCondicional * preco
      }
      return total
    }, 0)
  }

  const calcularValorCondicionalRepasse = () => {
    return produtosFiltrados.reduce((total, produto) => {
      if ((produto.status_item || 'resolvido') === 'condicional') {
        const repasse = produto.valor_repasse || 0
        const qtdCondicional = produto.quantidade_condicional || produto.quantidade || 0
        return total + qtdCondicional * repasse
      }
      return total
    }, 0)
  }

  const calcularQuantidadeCondicional = (produto: Produto) => {
    if ((produto.status_item || 'resolvido') === 'condicional') {
      return produto.quantidade_condicional || produto.quantidade || 0
    }
    return 0
  }

  const calcularQuantidadeEfetiva = (produto: Produto) => {
    if ((produto.status_item || 'resolvido') === 'resolvido') {
      return produto.quantidade || 0
    }
    return 0
  }

  const limparFiltros = () => {
    setFiltroDescricao('')
    setFiltroCodigo('')
    setFiltroStatus('todos')
  }

  const alternarOrdenacao = (campo: OrdenacaoTipo) => {
    if (ordenacaoPor === campo) {
      setOrdenacaoDirecao(ordenacaoDirecao === 'asc' ? 'desc' : 'asc')
    } else {
      setOrdenacaoPor(campo)
      setOrdenacaoDirecao('asc')
    }
  }

  const abrirModalEditar = (produto: Produto) => {
    setProdutoSelecionado(produto)
    setModalEditarAberto(true)
  }

  const abrirModalLog = (produto: Produto) => {
    setProdutoSelecionado(produto)
    setModalLogAberto(true)
  }

  const fecharModais = () => {
    setModalEditarAberto(false)
    setModalLogAberto(false)
    setProdutoSelecionado(null)
  }

  const handleProdutoAtualizado = () => {
    carregarProdutos()
    fecharModais()
  }

  const gerarPDF = () => {
    try {
      const logoConfig = obterConfigLogos()
      const gerador = new GeradorPDFProfissional(logoConfig)

      const filtros: string[] = []
      if (filtroDescricao) filtros.push(`DESCRIÇÃO: ${filtroDescricao.toUpperCase()}`)
      if (filtroCodigo) filtros.push(`CÓDIGO: ${filtroCodigo.toUpperCase()}`)
      if (filtroStatus !== 'todos') filtros.push(`STATUS: ${filtroStatus.toUpperCase()}`)

      gerador.gerarDocumento({
        tipo: 'estoque',
        titulo: 'Inventário de Estoque',
        data: new Date().toISOString().split('T')[0],
        entidade: 'Relatório Geral de Produtos',
        corTema: [185, 28, 28], // Red-700
        filtros: filtros,
        itens: produtosFiltrados.map(p => ({
          codigo: p.codigo,
          descricao: p.descricao,
          quantidade: p.quantidade,
          valorUnitario: p.preco_venda || 0,
          valorTotal: (p.quantidade || 0) * (p.preco_venda || 0),
          categoria: p.categoria
        })),
        total: calcularValorRealizadoVenda(),
        totalSecundario: calcularValorRealizadoRepasse(),
        observacoes: 'Relatório de conferência de estoque físico e financeiro (preço de venda).'
      })
      
      const nomeArquivo = `estoque_${new Date().toISOString().split('T')[0]}.pdf`
      gerador.salvar(nomeArquivo)
      
      alert('✅ PDF Profissional gerado com sucesso!')
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      alert('❌ Erro ao gerar PDF.')
    }
  }

  if (loading) {
    return (
      <div className="bg-white p-2 rounded-lg shadow-md text-center">
        <p className="text-gray-600 text-xs">Carregando estoque...</p>
      </div>
    )
  }

  const IconeOrdenacao = ({ campo }: { campo: OrdenacaoTipo }) => {
    if (ordenacaoPor !== campo) return <span className="text-gray-400 text-xs">⇅</span>
    return ordenacaoDirecao === 'asc' ? 
      <span className="text-blue-600 text-xs">↑</span> :
      <span className="text-blue-600 text-xs">↓</span>
  }

  return (
    <div className="space-y-0.5">
      {/* FILTRO MINIMIZADO NO TOPO */}
      <div className="bg-white rounded shadow-sm overflow-hidden border border-red-700">
        <button
          onClick={() => setFiltroAberto(!filtroAberto)}
          className="w-full px-3 py-1 flex justify-between items-center hover:bg-red-50 transition-colors text-red-700"
        >
          <span className="text-xs font-semibold tracking-widest uppercase flex items-center gap-1">🔍 Filtros e Ordenação</span>
          <span className="text-xs text-gray-400 flex items-center justify-center h-4 w-4">{filtroAberto ? '▲' : '▼'}</span>
        </button>
        
        {filtroAberto && (
          <div className="p-2 bg-white border-t border-red-100">
            <div className="grid grid-cols-4 gap-1.5 mb-1.5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-0.5">Descrição</label>
                <input
                  type="text"
                  value={filtroDescricao}
                  onChange={(e) => setFiltroDescricao(e.target.value)}
                  placeholder="Filtrar..."
                  className="w-full px-1.5 py-0.5 border border-gray-300 rounded text-xs outline-none"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-0.5">Código</label>
                <input
                  type="text"
                  value={filtroCodigo}
                  onChange={(e) => setFiltroCodigo(e.target.value)}
                  placeholder="Filtrar..."
                  className="w-full px-1.5 py-0.5 border border-gray-300 rounded text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-0.5">Status</label>
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value as 'todos' | 'resolvido' | 'condicional')}
                  className="w-full px-1.5 py-0.5 border border-gray-300 rounded text-xs outline-none"
                >
                  <option value="todos">Todos</option>
                  <option value="resolvido">Resolvido</option>
                  <option value="condicional">Condicional</option>
                </select>
              </div>

              <div className="flex items-end gap-1">
                <button
                  onClick={limparFiltros}
                  className="px-2 py-0.5 bg-gray-500 text-white text-xs font-semibold rounded hover:bg-gray-600"
                >
                  LIMPAR
                </button>
                <button
                  onClick={gerarPDF}
                  className="px-2 py-0.5 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700"
                >
                  📄 PDF
                </button>
              </div>
            </div>

            <div className="text-xs text-gray-600">
              <strong className="uppercase">Ordenar por:</strong>
              <div className="flex gap-1 mt-0.5 flex-wrap">
                <button
                  onClick={() => alternarOrdenacao('descricao')}
                  className={`px-1.5 py-0.5 rounded border ${ordenacaoPor === 'descricao' ? 'bg-pink-700 text-white border-pink-800' : 'bg-white text-gray-700 border-gray-200'}`}
                >
                  DESCRIÇÃO <IconeOrdenacao campo="descricao" />
                </button>
                <button
                  onClick={() => alternarOrdenacao('preco_venda')}
                  className={`px-1.5 py-0.5 rounded border ${ordenacaoPor === 'preco_venda' ? 'bg-pink-700 text-white border-pink-800' : 'bg-white text-gray-700 border-gray-200'}`}
                >
                  PREÇO <IconeOrdenacao campo="preco_venda" />
                </button>
                <button
                  onClick={() => alternarOrdenacao('categoria')}
                  className={`px-1.5 py-0.5 rounded border ${ordenacaoPor === 'categoria' ? 'bg-pink-700 text-white border-pink-800' : 'bg-white text-gray-700 border-gray-200'}`}
                >
                  CATEGORIA <IconeOrdenacao campo="categoria" />
                </button>
                <button
                  onClick={() => alternarOrdenacao('quantidade')}
                  className={`px-1.5 py-0.5 rounded border ${ordenacaoPor === 'quantidade' ? 'bg-pink-700 text-white border-pink-800' : 'bg-white text-gray-700 border-gray-200'}`}
                >
                  QUANTIDADE <IconeOrdenacao campo="quantidade" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cabeçalho com Botão e Valores do Estoque - COMPACTO */}
      <div className="bg-white rounded shadow-sm px-1.5 py-0.5 sm:px-3 sm:py-1 border border-gray-200">
        <div className="flex justify-between items-center mb-0.5 h-7 sm:h-8">
          <button
            onClick={() => {
              setProdutoSelecionado(null)
              setModalEditarAberto(true)
            }}
            className="bg-red-700 hover:bg-red-800 text-white px-2 sm:px-3 h-5 sm:h-6 flex items-center justify-center rounded text-[9px] sm:text-xs font-semibold transition-colors shadow-sm"
          >
            + CADASTRAR
          </button>

          <div className="text-right">
            <p className="text-[9px] sm:text-xs font-semibold text-gray-500 uppercase leading-none">Total</p>
            <p className="text-xs sm:text-sm font-semibold text-gray-800 leading-none">
              {produtosFiltrados.length}
            </p>
          </div>
        </div>

        {/* NOVO: Quadro de Valores do Estoque */}
        <div className="mt-1 border-t border-gray-100 pt-1">
          <p className="text-[10px] font-semibold text-gray-800 mb-0.5">VALOR EM ESTOQUE</p>
          
          <div className="grid grid-cols-2 gap-2">
            {/* Coluna Esquerda - Realizado (Destaque Principal) */}
            <div className="space-y-1">
              <div className="bg-green-50 border border-green-300 rounded p-1 shadow-sm">
                <p className="text-xs text-green-800 font-medium uppercase">Realizado (Venda)</p>
                <p className="text-lg font-bold text-green-700">
                  R$ {calcularValorRealizadoVenda().toFixed(2)}
                </p>
              </div>
              
              <div className="bg-blue-50 border border-blue-300 rounded p-1">
                <p className="text-xs text-blue-800 font-medium uppercase">Realizado (Repasse)</p>
                <p className="text-sm font-semibold text-blue-700">
                  R$ {calcularValorRealizadoRepasse().toFixed(2)}
                </p>
              </div>
            </div>
            
            {/* Coluna Direita - Condicional (Menor Destaque) */}
            <div className="space-y-1">
              <div className="bg-yellow-50 border border-yellow-300 rounded p-1">
                <p className="text-xs text-yellow-800 font-medium uppercase">Condicional (Venda)</p>
                <p className="text-sm font-semibold text-yellow-700">
                  R$ {calcularValorCondicionalVenda().toFixed(2)}
                </p>
              </div>
              
              <div className="bg-orange-50 border border-orange-300 rounded p-1">
                <p className="text-xs text-orange-800 font-medium uppercase">Condicional (Repasse)</p>
                <p className="text-sm font-semibold text-orange-700">
                  R$ {calcularValorCondicionalRepasse().toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Estoque */}
      <div className="bg-white rounded shadow-sm overflow-hidden border border-gray-200">
        <div className="bg-red-700 flex justify-between items-center px-1.5 py-0.5 sm:px-3 sm:py-1 text-white border-b border-red-800 h-7 sm:h-8">
          <h2 className="text-[10px] sm:text-xs font-semibold uppercase tracking-tight sm:tracking-widest flex items-center">Estoque ({produtosFiltrados.length})</h2>
        </div>
        {produtosFiltrados.length === 0 ? (
          <div className="p-2 text-center text-gray-500">
            <p className="text-[10px] sm:text-xs">Vazio</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[9px] sm:text-xs">
              <thead className="bg-red-700 text-white border-b border-red-800">
                <tr>
                <th className="px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-left font-semibold uppercase w-[50px] sm:w-auto">Cód.</th>
                <th className="px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-left font-semibold uppercase min-w-[100px]">Descrição</th>
                <th className="px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-center font-semibold uppercase hidden sm:table-cell">Categoria</th>
                <th className="px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-center font-semibold uppercase w-[50px] sm:w-auto">Status</th>
                <th className="px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-center font-semibold uppercase w-[35px] sm:w-auto">Cond.</th>
                <th className="px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-center font-semibold uppercase w-[35px] sm:w-auto">Efet.</th>
                <th className="px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-right font-semibold uppercase hidden md:table-cell">Custo</th>
                <th className="px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-right font-semibold uppercase hidden md:table-cell">Repasse</th>
                <th className="px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-right font-semibold uppercase w-[60px] sm:w-auto">Venda</th>
                <th className="px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-left font-semibold uppercase hidden lg:table-cell">Ult. Compra</th>
                <th className="px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-center font-semibold uppercase w-[50px] sm:w-auto">Ações</th>
                </tr>
              </thead>
              <tbody>
                {produtosFiltrados.map((produto) => {
                  const qtdCondicional = calcularQuantidadeCondicional(produto)
                  const qtdEfetiva = calcularQuantidadeEfetiva(produto)
                  const temEstoqueNegativo = qtdEfetiva < 0

                  return (
                    <tr
                      key={produto.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        temEstoqueNegativo ? 'bg-red-50' : (produto.status_item || 'resolvido') === 'condicional' ? 'bg-yellow-50' : ''
                      }`}
                    >
                      <td className="px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-gray-800 font-medium">{produto.codigo}</td>
                      <td className="px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-gray-800 truncate max-w-[100px] sm:max-w-none">{produto.descricao}</td>
                      <td className="px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-center hidden sm:table-cell">
                        <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-medium text-[10px]">
                          {produto.categoria || 'Sem categoria'}
                        </span>
                      </td>
                      <td className="px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-center">
                        <span className={`inline-block px-1 py-0.5 rounded-full font-medium text-[8px] sm:text-[10px] ${
                          (produto.status_item || 'resolvido') === 'resolvido' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {(produto.status_item || 'resolvido') === 'resolvido' ? '✓ Res.' : '⏳ Cond.'}
                        </span>
                      </td>
                      <td className={`px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-center font-semibold ${
                        qtdCondicional !== 0 ? 'bg-yellow-100 text-yellow-800' : 'text-gray-500'
                      }`}>
                        {qtdCondicional}
                      </td>
                      <td className={`px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-center font-semibold ${
                        temEstoqueNegativo ? 'bg-red-200 text-red-900 font-bold' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {qtdEfetiva}
                      </td>
                      <td className="px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-right text-gray-700 hidden md:table-cell">
                        {produto.preco_custo.toFixed(2)}
                      </td>
                      <td className="px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-right text-gray-700 hidden md:table-cell">
                        {(Number(produto.valor_repasse) || 0).toFixed(2)}
                      </td>
                      <td className="px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-right text-gray-700 font-semibold">
                        {(Number(produto.preco_venda) || 0).toFixed(2)}
                      </td>
                      <td className="px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-gray-600 hidden lg:table-cell">
                        {formatarDataParaExibicao(produto.data_ultima_compra)}
                      </td>
                      <td className="px-0.5 py-0.5 sm:px-1.5 sm:py-1 text-center">
                        <div className="flex gap-0.5 justify-center">
                          <button
                            onClick={() => abrirModalEditar(produto)}
                            className="bg-red-700 hover:bg-red-800 text-white px-1 sm:px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors"
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => abrirModalLog(produto)}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-1 sm:px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors"
                            title="Log"
                          >
                            📋
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modais */}
      {modalEditarAberto && (
        <ModalEditarProduto
          produto={produtoSelecionado}
          onClose={fecharModais}
          onSave={handleProdutoAtualizado}
        />
      )}

      {modalLogAberto && produtoSelecionado && (
        <ModalLogProduto produto={produtoSelecionado} onClose={fecharModais} />
      )}
    </div>
  )
}
