'use client'

import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import ModalPagarAvancado from './ModalPagarAvancado'
import { useEffect, useState, useMemo } from 'react'
import { useDadosFinanceiros, CentroCusto, LancamentoFinanceiro } from '@/context/DadosFinanceirosContext'
import { useFilters } from '@/context/FilterContext'
import { getDataAtualBrasil, formatarDataParaExibicao, calcularDataPorPrazo } from '@/lib/dateUtils'
import CaixaCasaDetalhado from './CaixaCasaDetalhado'
import FiltrosCasa from './FiltrosCasa'
import { GeradorPDFLancamentos } from '@/lib/gerador-pdf-lancamentos'
import { obterConfigLogos } from '@/lib/gerador-pdf-utils'

// As interfaces CentroCusto e Lancamento agora são importadas do DadosFinanceirosContext
type Lancamento = LancamentoFinanceiro;

interface FormLancamento {
  descricao: string
  valor: string
  tipo: string
  centroCustoId: string
  data: string
  status: string
  parcelas: number
  prazoParcelas: string
  recorrenciaTipo: string
  recorrenciaQtd: number
  recorrenciaPrazo: string
  recorrenciaDia: string
}

// CONSTANTE: ID do Caixa Casa
const CAIXA_ID_CASA = '69bebc06-f495-4fed-b0b1-beafb50c017b'

// ✅ CORREÇÃO: Função auxiliar para calcular a data de ontem
const getOntemBrasil = () => {
  const hoje = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Sao_Paulo'
  });
  
  const hojeFormatado = formatter.format(hoje);
  const [anoHoje, mesHoje, diaHoje] = hojeFormatado.split('-').map(Number);
  
  // Criar data de ontem
  const dataOntem = new Date(anoHoje, mesHoje - 1, diaHoje - 1);
  return formatter.format(dataOntem);
}

// ✅ Função auxiliar para calcular a data N dias à frente (usando dateUtils)
import { getDataNDias } from '@/lib/dateUtils'

// Função para validar se todos os campos estão preenchidos
const validarFormulario = (form: FormLancamento): boolean => {
  if (!form.descricao.trim()) {
    alert('❌ Descrição é obrigatória');
    return false;
  }
  if (!form.valor || parseFloat(form.valor) <= 0) {
    alert('❌ Valor é obrigatório e deve ser maior que zero');
    return false;
  }
  if (!form.tipo) {
    alert('❌ Tipo é obrigatório');
    return false;
  }
  if (!form.centroCustoId) {
    alert('❌ Centro de Custo é obrigatório');
    return false;
  }
  if (!form.data) {
    alert('❌ Data é obrigatória');
    return false;
  }
  if (!form.status) {
    alert('❌ Status é obrigatório');
    return false;
  }
  return true;
}

export default function CasaModulo() {
  const { dados, recarregarDados, carregando: carregandoContexto } = useDadosFinanceiros()
  const { filtersCasa, setFiltersCasa } = useFilters()
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([])
  const [loading, setLoading] = useState(false)
  const [carregandoInicial, setCarregandoInicial] = useState(true)
  
  // Atalhos para os filtros do contexto
  const filtroDataInicio = filtersCasa.dataInicio
  const setFiltroDataInicio = (v: string) => setFiltersCasa(prev => ({ ...prev, dataInicio: v }))
  const filtroDataFim = filtersCasa.dataFim
  const setFiltroDataFim = (v: string) => setFiltersCasa(prev => ({ ...prev, dataFim: v }))
  const filtroMes = filtersCasa.mes
  const setFiltroMes = (v: string) => setFiltersCasa(prev => ({ ...prev, mes: v }))
  const filtroDescricao = filtersCasa.descricao
  const setFiltroDescricao = (v: string) => setFiltersCasa(prev => ({ ...prev, descricao: v }))
  const filtroCDC = filtersCasa.cdc
  const setFiltroCDC = (v: string) => setFiltersCasa(prev => ({ ...prev, cdc: v }))
  const filtroStatus = filtersCasa.status
  const setFiltroStatus = (v: string) => setFiltersCasa(prev => ({ ...prev, status: v }))
  const mostrarTodos = filtersCasa.mostrarTodos
  const setMostrarTodos = (v: boolean) => setFiltersCasa(prev => ({ ...prev, mostrarTodos: v }))
  
  const [abaLancamentos, setAbaLancamentos] = useState<'padrao' | 'recorrente'>('padrao')
  const [formularioAberto, setFormularioAberto] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  
  const [modalPagar, setModalPagar] = useState<{ 
    aberto: boolean; 
    lancamento: Lancamento | null;
    passo: 'inicial' | 'valor' | 'decisao' | 'nova_data';
    valorPago: number | null;
    dataPagamento: string;
    novaDataVencimento: string;
    pagarTotal: boolean;
  }>({
    aberto: false,
    lancamento: null,
    passo: 'inicial',
    valorPago: null,
    dataPagamento: getDataAtualBrasil(),
    novaDataVencimento: getDataAtualBrasil(),
    pagarTotal: true
  })

  const [modalExcluir, setModalExcluir] = useState<{ aberto: boolean; lancamento: Lancamento | null }>({
    aberto: false,
    lancamento: null
  })
  const [editandoLancamento, setEditandoLancamento] = useState<Lancamento | null>(null)
  const [caixaMinimizado, setCaixaMinimizado] = useState(true)
  
  const [form, setForm] = useState<FormLancamento>({
    descricao: '',
    valor: '',
    tipo: 'saida',
    centroCustoId: '',
    data: getDataAtualBrasil(),
    status: 'previsto',
    parcelas: 1,
    prazoParcelas: 'mensal',
    recorrenciaTipo: 'nenhuma',
    recorrenciaQtd: 1,
    recorrenciaPrazo: 'mensal',
    recorrenciaDia: ''
  })

  // ✅ CORREÇÃO: Carregar lançamentos iniciais APENAS UMA VEZ
  useEffect(() => {
    const carregarDadosIniciais = async () => {
      console.log('📥 Carregando dados iniciais do módulo casa...')
      
      // Aguardar contexto carregar primeiro
      if (carregandoContexto) {
        console.log('⏳ Aguardando contexto carregar...')
        return
      }
      
      // Carregar lançamentos se ainda não foram carregados
      if (dados.todosLancamentosCasa.length === 0) {
        console.log('🔄 Carregando lançamentos do módulo casa...')
        recarregarDados()
      }
      
      setCarregandoInicial(false)
      console.log('✅ Dados iniciais carregados')
    }
    
    carregarDadosIniciais()
  }, [carregandoContexto, dados.todosLancamentosCasa.length, recarregarDados])

  // ✅ Carregar centros de custo do contexto
  useEffect(() => {
    if (dados.centrosCustoCasa.length > 0 && centrosCusto.length === 0) {
      console.log('✅ Carregando centros de custo do contexto')
      setCentrosCusto(dados.centrosCustoCasa)
    }
  }, [dados.centrosCustoCasa, centrosCusto.length])

  // ✅ Carregar user apenas uma vez
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    loadUser()
  }, [])

  const centrosCustoFiltrados = useMemo(() => {
    return centrosCusto.filter(centro => {
      if (form.tipo === 'entrada') {
        return centro.tipo === 'RECEITA'
      } else {
        return centro.tipo === 'DESPESA'
      }
    })
  }, [centrosCusto, form.tipo])

  const adicionarLancamento = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) return

    if (!validarFormulario(form)) {
      return;
    }

    setLoading(true)

    const dataAtual = getDataAtualBrasil()
    const dataParaLancamento = form.status === 'pago' ? dataAtual : form.data

    const valorNumerico = parseFloat(form.valor)
    const descricaoMaiuscula = form.descricao.toUpperCase()

    try {
      if (abaLancamentos === 'padrao') {
        const valorNumerico = parseFloat(form.valor)
        if (form.parcelas === 1) {
          const dadosLancamento = {
            user_id: user.id,
            descricao: descricaoMaiuscula,
            valor: valorNumerico,
            tipo: form.tipo,
            centro_custo_id: form.centroCustoId || null,
            data_lancamento: dataParaLancamento,
            data_prevista: form.data,
            status: form.status === 'pago' ? 'realizado' : 'previsto',
            caixa_id: CAIXA_ID_CASA,
            parcelamento: null,
            recorrencia: null
          }

          const { error } = await supabase
            .from('lancamentos_financeiros')
            .insert([dadosLancamento]) // ✅ CORREÇÃO: Colocar em array []
            .select()

          if (error) throw error
        } else {
          const valorBase = Math.ceil((valorNumerico / form.parcelas) * 100) / 100
          const valorUltima = Number((valorNumerico - (valorBase * (form.parcelas - 1))).toFixed(2))

          const lancamentosParcelados = []

          for (let i = 1; i <= form.parcelas; i++) {
            let dataParcela = form.data
            if (i > 1) {
              const dataAnterior = lancamentosParcelados[i - 2].data_prevista
              dataParcela = calcularDataPorPrazo(dataAnterior, form.prazoParcelas)
            }

            const valorFinalParcela = i === form.parcelas ? valorUltima : valorBase

            lancamentosParcelados.push({
              user_id: user.id,
              descricao: `${descricaoMaiuscula} (${i}/${form.parcelas})`,
              valor: valorFinalParcela,
              tipo: form.tipo,
              centro_custo_id: form.centroCustoId || null,
              data_lancamento: dataParcela,
              data_prevista: dataParcela,
              status: 'previsto',
              caixa_id: CAIXA_ID_CASA,
              parcelamento: { atual: i, total: form.parcelas },
              recorrencia: null
            })
          }

          const { error } = await supabase
            .from('lancamentos_financeiros')
            .insert(lancamentosParcelados)
            .select()

          if (error) throw error
        }
      } else {
        const lancamentosRecorrentes = []

        for (let i = 1; i <= form.recorrenciaQtd; i++) {
          let dataLancamento = form.data
          if (i > 1) {
            const dataAnterior = lancamentosRecorrentes[i - 2].data_prevista
            dataLancamento = calcularDataPorPrazo(dataAnterior, form.recorrenciaPrazo)
          }

          lancamentosRecorrentes.push({
            user_id: user.id,
            descricao: `${descricaoMaiuscula} (${i}/${form.recorrenciaQtd})`,
            valor: valorNumerico,
            tipo: form.tipo,
            centro_custo_id: form.centroCustoId || null,
            data_lancamento: dataLancamento,
            data_prevista: dataLancamento,
            status: 'previsto',
            caixa_id: CAIXA_ID_CASA,
            parcelamento: null,
            recorrencia: { tipo: 'quantidade', qtd: form.recorrenciaQtd, prazo: form.recorrenciaPrazo }
          })
        }

        const { error } = await supabase
          .from('lancamentos_financeiros')
          .insert(lancamentosRecorrentes)
          .select()

        if (error) throw error
      }

      // Limpar formulário
      setForm({
        descricao: '',
        valor: '',
        tipo: 'saida',
        centroCustoId: '',
        data: getDataAtualBrasil(),
        status: 'previsto',
        parcelas: 1,
        prazoParcelas: 'mensal',
        recorrenciaTipo: 'nenhuma',
        recorrenciaQtd: 1,
        recorrenciaPrazo: 'mensal',
        recorrenciaDia: ''
      })
      
      // Recarregar apenas os dados necessários
      recarregarDados()
      
      setFormularioAberto(false)
      alert('✅ Lançamento adicionado com sucesso!')
    } catch (error: unknown) {
      console.error('Erro ao adicionar lançamento:', error)
      const msg = error instanceof Error ? error.message : String(error)
      alert('❌ Erro ao adicionar lançamento: ' + msg)
    } finally {
      setLoading(false)
    }
  }

  const processarPagamento = async (criarNovaParcela: boolean = false) => {
    const { lancamento, valorPago, dataPagamento, novaDataVencimento } = modalPagar
    
    if (!lancamento || !user) return

    setLoading(true)

    try {
      const valorOriginal = lancamento.valor
      const valorPagoFinal = valorPago !== null ? valorPago : valorOriginal
      const valorRestante = Math.max(0, valorOriginal - valorPagoFinal)

      const parcelaAtual = lancamento.parcelamento?.atual || 1
      const totalParcelas = lancamento.parcelamento?.total || 1
      const descricaoOriginal = lancamento.descricao
      const descricaoBase = descricaoOriginal.replace(/\s*\(\d+\/\d+\)\s*$/, '')

      let novaDescricaoOriginal = descricaoOriginal
      let novoParcelamento = lancamento.parcelamento

      // Se for criar nova parcela, o lançamento atual vira uma parcela de um total maior
      if (criarNovaParcela && valorRestante > 0.01) {
        novoParcelamento = { atual: parcelaAtual, total: totalParcelas + 1 }
        novaDescricaoOriginal = `${descricaoBase} (${parcelaAtual}/${totalParcelas + 1})`
      }

      // 1. Atualizar o lançamento atual para 'realizado' com o valor realmente pago
      // ✅ CORREÇÃO: Usar dataPagamento também em data_prevista para que a lista mostre a data correta da quitação
      const { error: errorUpdate } = await supabase
        .from('lancamentos_financeiros')
        .update({
          status: 'realizado',
          valor: valorPagoFinal,
          data_lancamento: dataPagamento,
          data_prevista: dataPagamento,
          descricao: novaDescricaoOriginal,
          parcelamento: novoParcelamento
        })
        .eq('id', lancamento.id)

      if (errorUpdate) throw errorUpdate

      // 2. Se o usuário escolheu criar uma nova parcela para o restante
      if (criarNovaParcela && valorRestante > 0.01) {
        const novaDescricaoParcela = `${descricaoBase} (${totalParcelas + 1}/${totalParcelas + 1})`
        
        const dadosNovaParcela = {
          user_id: user.id,
          descricao: novaDescricaoParcela,
          valor: valorRestante,
          tipo: lancamento.tipo,
          centro_custo_id: lancamento.centro_custo_id,
          data_lancamento: novaDataVencimento,
          data_prevista: novaDataVencimento,
          status: 'previsto',
          caixa_id: lancamento.caixa_id || CAIXA_ID_CASA,
          origem: lancamento.origem,
          parcelamento: { atual: totalParcelas + 1, total: totalParcelas + 1 },
          recorrencia: lancamento.recorrencia
        }

        const { error: errorInsert } = await supabase
          .from('lancamentos_financeiros')
          .insert([dadosNovaParcela])
          .select()

        if (errorInsert) throw errorInsert
      }

      setModalPagar({ 
        aberto: false, 
        lancamento: null, 
        passo: 'inicial',
        valorPago: null, 
        dataPagamento: getDataAtualBrasil(),
        novaDataVencimento: getDataAtualBrasil(),
        pagarTotal: true
      })

      alert('✅ Pagamento processado com sucesso!')
      
      // Recarregar apenas os dados necessários
      recarregarDados()
    } catch (error: unknown) {
      console.error('Erro ao processar pagamento:', error)
      const msg = error instanceof Error ? error.message : String(error)
      alert('❌ Erro ao processar pagamento: ' + msg)
    } finally {
      setLoading(false)
    }
  }

  const excluirLancamento = async (lancamento: Lancamento) => {
    try {
      const { error } = await supabase
        .from('lancamentos_financeiros')
        .delete()
        .eq('id', lancamento.id)

      if (error) throw error

      setModalExcluir({ aberto: false, lancamento: null })
      
      alert('✅ Lançamento excluído com sucesso!')
      
      // Recarregar apenas os dados necessários
      recarregarDados()
    } catch (error: unknown) {
      console.error('Erro ao excluir lançamento:', error)
      const msg = error instanceof Error ? error.message : String(error)
      alert('❌ Erro ao excluir lançamento: ' + msg)
    }
  }

  const iniciarEdicao = (lancamento: Lancamento) => {
    setEditandoLancamento(lancamento)
    
    const dataDoBanco = lancamento.data_lancamento
    const dataPrevistaDoBanco = lancamento.data_prevista || dataDoBanco || getDataAtualBrasil()
    
    const dataFormatada = dataPrevistaDoBanco.includes('T') 
      ? dataPrevistaDoBanco.split('T')[0]
      : dataPrevistaDoBanco
    
    setForm({
      descricao: lancamento.descricao,
      valor: lancamento.valor.toString(),
      tipo: lancamento.tipo,
      centroCustoId: lancamento.centro_custo_id || '',
      data: dataFormatada,
      status: lancamento.status === 'realizado' ? 'pago' : 'previsto',
      parcelas: lancamento.parcelamento?.total || 1,
      prazoParcelas: lancamento.parcelamento ? 'mensal' : 'mensal',
      recorrenciaTipo: lancamento.recorrencia?.tipo || 'nenhuma',
      recorrenciaQtd: lancamento.recorrencia?.qtd || 1,
      recorrenciaPrazo: lancamento.recorrencia?.prazo || 'mensal',
      recorrenciaDia: lancamento.recorrencia?.dia || ''
    })
    
    setFormularioAberto(true)
  }

  const salvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editandoLancamento || !user) return

    if (!validarFormulario(form)) {
      return;
    }

    setLoading(true)

    const dataAtual = getDataAtualBrasil()
    const dataParaLancamento = form.status === 'pago' ? dataAtual : form.data

    const valorNumerico = parseFloat(form.valor)
    const descricaoMaiuscula = form.descricao.toUpperCase()

    try {
      const dadosLancamento = {
        descricao: descricaoMaiuscula,
        valor: valorNumerico,
        tipo: form.tipo,
        centro_custo_id: form.centroCustoId || null,
        data_lancamento: dataParaLancamento, 
        data_prevista: form.data,   
        status: form.status === 'pago' ? 'realizado' : 'previsto',
        caixa_id: CAIXA_ID_CASA,
        parcelamento: editandoLancamento.parcelamento,
        recorrencia: form.recorrenciaTipo !== 'nenhuma' ? {
          tipo: form.recorrenciaTipo,
          dia: form.recorrenciaDia || form.data.split('-')[2]
        } : null
      }

      const { error } = await supabase
        .from('lancamentos_financeiros')
        .update([dadosLancamento]) // ✅ CORREÇÃO: Colocar em array []
        .eq('id', editandoLancamento.id)

      if (error) throw error

      setEditandoLancamento(null)
      setForm({
        descricao: '',
        valor: '',
        tipo: 'saida',
        centroCustoId: '',
        data: getDataAtualBrasil(),
        status: 'previsto',
        parcelas: 1,
        prazoParcelas: 'mensal',
        recorrenciaTipo: 'nenhuma',
        recorrenciaQtd: 1,
        recorrenciaPrazo: 'mensal',
        recorrenciaDia: ''
      })
      
      setFormularioAberto(false)
      alert('✅ Lançamento editado com sucesso!')
      
      // Recarregar apenas os dados necessários
      recarregarDados()
    } catch (error: unknown) {
      console.error('Erro ao salvar edição:', error)
      const msg = error instanceof Error ? error.message : String(error)
      alert('❌ Erro ao salvar edição: ' + msg)
    } finally {
      setLoading(false)
    }
  }

  const cancelarEdicao = () => {
    setEditandoLancamento(null)
    setForm({
      descricao: '',
      valor: '',
      tipo: 'saida',
      centroCustoId: '',
      data: getDataAtualBrasil(),
      status: 'previsto',
      parcelas: 1,
      prazoParcelas: 'mensal',
      recorrenciaTipo: 'nenhuma',
      recorrenciaQtd: 1,
      recorrenciaPrazo: 'mensal',
      recorrenciaDia: ''
    })
    setFormularioAberto(false)
  }

  const handleDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({...form, data: e.target.value})
  }

  // ✅ OTIMIZADO: Usar lançamentos do contexto diretamente
  const lancamentosFiltrados = useMemo(() => {
    if (carregandoInicial || dados.todosLancamentosCasa.length === 0) {
      console.log('⏳ Aguardando carregamento inicial...')
      return []
    }

    console.log('🔍 Aplicando filtros... Total lançamentos:', dados.todosLancamentosCasa.length)
    
    let resultado = [...dados.todosLancamentosCasa]

    // Ordenar por data crescente (do mais antigo para o mais novo)
    resultado.sort((a, b) => {
      const dataA = new Date(a.data_prevista || a.data_lancamento || new Date()).getTime()
      const dataB = new Date(b.data_prevista || b.data_lancamento || new Date()).getTime()
      return dataA - dataB
    })

    // Aplicar filtros
    if (filtroDataInicio) {
      resultado = resultado.filter(lanc => {
        const dataLanc = lanc.data_prevista || lanc.data_lancamento || ''
        return dataLanc >= filtroDataInicio
      })
    }

    if (filtroDataFim) {
      resultado = resultado.filter(lanc => {
        const dataLanc = lanc.data_prevista || lanc.data_lancamento || ''
        return dataLanc <= filtroDataFim
      })
    }

    if (filtroMes) {
      resultado = resultado.filter(lanc => {
        const dataLanc = lanc.data_prevista || lanc.data_lancamento || ''
        return dataLanc.startsWith(filtroMes)
      })
    }

    if (filtroDescricao) {
      resultado = resultado.filter(lanc => 
        lanc.descricao.toLowerCase().includes(filtroDescricao.toLowerCase())
      )
    }

    if (filtroCDC) {
      resultado = resultado.filter(lanc => lanc.centro_custo_id === filtroCDC)
    }

    if (filtroStatus && filtroStatus !== 'todos') {
      resultado = resultado.filter(lanc => lanc.status === filtroStatus)
    }

    // ✅ CORREÇÃO: Aplicar filtro padrão de 11 dias apenas quando NÃO estiver em "VER TUDO"
    // e quando NÃO houver nenhum filtro ativo
    if (!mostrarTodos && 
        !filtroDataInicio && 
        !filtroDataFim && 
        !filtroMes && 
        !filtroDescricao && 
        !filtroCDC && 
        !filtroStatus) {
      
      const inicio = getOntemBrasil()
      const fim = getDataNDias(inicio, 10)
      
      console.log(`Filtro padrão 11 dias: ${inicio} até ${fim}`)
      
      resultado = resultado.filter(lanc => {
        const dataLanc = lanc.data_prevista || lanc.data_lancamento || ''
        return dataLanc >= inicio && dataLanc <= fim
      })
    }

    console.log(`✅ Resultado final: ${resultado.length} lançamentos`)
    return resultado
  }, [dados.todosLancamentosCasa, filtroDataInicio, filtroDataFim, filtroMes, filtroDescricao, filtroCDC, filtroStatus, mostrarTodos, carregandoInicial])

  const limparFiltros = () => {
    setFiltersCasa({
      dataInicio: '',
      dataFim: '',
      mes: '',
      descricao: '',
      cdc: '',
      status: '',
      mostrarTodos: false,
    })
  }
  
  const gerarPDF = () => {
    if (lancamentosFiltrados.length === 0) {
      alert('❌ Nenhum lançamento para gerar PDF com os filtros aplicados')
      return
    }

    const filtrosAplicados: string[] = []
    if (filtroMes) filtrosAplicados.push(`MÊS: ${filtroMes}`)
    if (filtroDescricao) filtrosAplicados.push(`BUSCA: ${filtroDescricao.toUpperCase()}`)
    if (filtroStatus && filtroStatus !== 'todos') filtrosAplicados.push(`STATUS: ${filtroStatus.toUpperCase()}`)
    if (mostrarTodos) filtrosAplicados.push("VISUALIZAÇÃO COMPLETA")
    else if (!filtroDataInicio && !filtroDataFim && !filtroMes) filtrosAplicados.push("VISUALIZAÇÃO 11 DIAS")

    const gerador = new GeradorPDFLancamentos()
    gerador.gerarPDFLancamentosCasa(lancamentosFiltrados, centrosCusto, filtrosAplicados)
  }

  const ModalExcluir = () => {
    if (!modalExcluir.aberto || !modalExcluir.lancamento) return null

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
        <div className="bg-white p-4 rounded-lg shadow-xl w-full max-w-sm">
          <h3 className="text-sm font-semibold mb-3">Confirmar Exclusão</h3>
          <p className="text-xs text-gray-700 mb-3">
            Tem certeza que deseja excluir o lançamento &quot;{modalExcluir.lancamento.descricao}&quot;? Esta ação é irreversível.
          </p>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setModalExcluir({ aberto: false, lancamento: null })}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              onClick={() => excluirLancamento(modalExcluir.lancamento!)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              Sim, Excluir
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ✅ TÍTULO DINÂMICO DA TABELA
  const getTituloTabela = () => {
    if (mostrarTodos) return 'TODOS OS LANÇAMENTOS'
    if (filtroMes) return `Lançamentos de ${filtroMes}`
    if (filtroDataInicio || filtroDataFim) return 'Lançamentos Filtrados'
    
    const inicio = getOntemBrasil()
    const fim = getDataNDias(inicio, 10)
    return `Próximos 11 Dias (${formatarDataParaExibicao(inicio)} a ${formatarDataParaExibicao(fim)})`
  }

  const tituloTabela = getTituloTabela()

  return (
    <div className="space-y-1">
      {/* ✅ FILTROS CASA */}
      <FiltrosCasa
        filtroDataInicio={filtroDataInicio}
        setFiltroDataInicio={setFiltroDataInicio}
        filtroDataFim={filtroDataFim}
        setFiltroDataFim={setFiltroDataFim}
        filtroMes={filtroMes}
        setFiltroMes={setFiltroMes}
        filtroDescricao={filtroDescricao}
        setFiltroDescricao={setFiltroDescricao}
        filtroCDC={filtroCDC}
        setFiltroCDC={setFiltroCDC}
        filtroStatus={filtroStatus}
        setFiltroStatus={setFiltroStatus}
        centrosCusto={centrosCusto}
        onLimpar={limparFiltros}
        onGerarPDF={gerarPDF}
      />

      <ModalPagarAvancado 
        modalPagar={modalPagar} 
        setModalPagar={setModalPagar} 
        processarPagamento={processarPagamento} 
      />
      <ModalExcluir />

      <div className="bg-blue-600 rounded shadow-sm overflow-hidden border border-blue-700">
        <button
          onClick={() => setFormularioAberto(!formularioAberto)}
          className="w-full px-3 py-1 flex justify-between items-center hover:bg-blue-700 transition-colors text-white"
        >
          <span className="text-xs font-semibold uppercase tracking-widest">
            {editandoLancamento ? '✏️ Editar Lançamento' : '➕ Novo Lançamento'}
          </span>
          <span className="text-xs text-gray-600">{formularioAberto ? '▲' : '▼'}</span>
        </button>
        
        {formularioAberto && (
          <div className="p-2 bg-white border-t border-blue-200">
            <div className="flex space-x-2 mb-2 border-b border-gray-200">
              <button
                onClick={() => setAbaLancamentos('padrao')}
                className={`px-3 py-1 font-medium text-xs border-b-2 transition-colors ${
                  abaLancamentos === 'padrao'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                À Vista / Parcelado
              </button>
              <button
                onClick={() => setAbaLancamentos('recorrente')}
                className={`px-3 py-1 font-medium text-xs border-b-2 transition-colors ${
                  abaLancamentos === 'recorrente'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Recorrente
              </button>
            </div>

            <form onSubmit={editandoLancamento ? salvarEdicao : adicionarLancamento} className="space-y-2 sm:space-y-1.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Descrição *</label>
                  <input
                    type="text"
                    value={form.descricao}
                    onChange={(e) => setForm({...form, descricao: e.target.value})}
                    className="block w-full px-2 py-1.5 sm:py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Descrição do lançamento"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Valor Total *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.valor}
                    onChange={(e) => setForm({...form, valor: e.target.value})}
                    className="block w-full px-2 py-1.5 sm:py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Tipo *</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({...form, tipo: e.target.value})}
                    className="block w-full px-2 py-1.5 sm:py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="saida">Saída</option>
                    <option value="entrada">Entrada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Status *</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({...form, status: e.target.value})}
                    className="block w-full px-2 py-1.5 sm:py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="pago">Pago</option>
                    <option value="previsto">Previsto</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Centro de Custo *</label>
                  <select
                    value={form.centroCustoId}
                    onChange={(e) => setForm({...form, centroCustoId: e.target.value})}
                    className="block w-full px-2 py-1.5 sm:py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="">Selecione...</option>
                    {centrosCustoFiltrados.map(centro => (
                      <option key={centro.id} value={centro.id}>{centro.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Data *</label>
                  <input
                    type="date"
                    value={form.data}
                    onChange={handleDataChange} 
                    className="block w-full px-2 py-1.5 sm:py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {abaLancamentos === 'padrao' ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Parcelas</label>
                    <input
                      type="number"
                      min="1"
                      value={form.parcelas}
                      onChange={(e) => setForm({...form, parcelas: parseInt(e.target.value) || 1})}
                      className="block w-full px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  {form.parcelas > 1 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Prazo entre Parcelas</label>
                      <select
                        value={form.prazoParcelas}
                        onChange={(e) => setForm({...form, prazoParcelas: e.target.value})}
                        className="block w-full px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="diaria">Diária</option>
                        <option value="semanal">Semanal</option>
                        <option value="10dias">10 Dias</option>
                        <option value="quinzenal">Quinzenal</option>
                        <option value="20dias">20 Dias</option>
                        <option value="mensal">Mensal</option>
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Quantidade de Vezes</label>
                    <input
                      type="number"
                      min="1"
                      value={form.recorrenciaQtd}
                      onChange={(e) => setForm({...form, recorrenciaQtd: parseInt(e.target.value) || 1})}
                      className="block w-full px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Prazo entre Lançamentos</label>
                    <select
                      value={form.recorrenciaPrazo}
                      onChange={(e) => setForm({...form, recorrenciaPrazo: e.target.value})}
                      className="block w-full px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="diaria">Diária</option>
                      <option value="semanal">Semanal</option>
                      <option value="10dias">10 Dias</option>
                      <option value="quinzenal">Quinzenal</option>
                      <option value="20dias">20 Dias</option>
                      <option value="mensal">Mensal</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex space-x-2 pt-1">
                <button
                  type="button"
                  onClick={cancelarEdicao}
                  className="flex-1 bg-gray-200 text-gray-700 py-1 px-3 rounded-md hover:bg-gray-300 text-xs font-semibold uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] bg-blue-600 text-white py-1 px-3 rounded-md hover:bg-blue-700 disabled:opacity-50 text-xs font-bold uppercase"
                >
                  {loading ? 'Salvando...' : editandoLancamento ? 'Salvar Lançamento' : 'Adicionar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-3 items-start relative">
        {/* Barra Lateral do Caixa (Retrátil) */}
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${caixaMinimizado ? 'w-0 opacity-0' : 'w-full lg:w-1/4 opacity-100'}`}
        >
          <div className="min-w-[250px]">
            <CaixaCasaDetalhado titulo="CAIXA CASA" />
          </div>
        </div>

        {/* Lista de Lançamentos (Expandida) */}
        <div className="flex-1 min-h-0 w-full">
          <div className="bg-white rounded shadow-sm overflow-hidden border border-gray-200">
            {/* ✅ CABEÇALHO COM BOTÃO "VER TUDO / 11 DIAS" E EXPANSÃO */}
            <div className="bg-blue-600 flex justify-between items-center px-3 py-1 text-white border-b border-blue-700">
               <div className="flex items-center gap-4 h-full">
                <button
                  onClick={() => setCaixaMinimizado(!caixaMinimizado)}
                  className="bg-white text-blue-600 hover:bg-blue-50 px-2 h-5 rounded text-[10px] font-semibold uppercase transition-all shadow-sm flex items-center gap-1"
                  title={caixaMinimizado ? "Mostrar Caixa" : "Esconder Caixa"}
                >
                  <span className="text-xs">📊</span> {caixaMinimizado ? 'EXIBIR CAIXAS' : 'RECOLHER'}
                </button>
                <h2 className="text-xs font-semibold uppercase tracking-widest flex items-center">{tituloTabela}</h2>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setMostrarTodos(!mostrarTodos)}
                  className="bg-white text-blue-600 hover:bg-blue-50 px-2 h-5 rounded text-[10px] font-semibold uppercase transition-all shadow-sm"
                >
                  {mostrarTodos ? '11 DIAS' : 'VER TUDO'}
                </button>
                {carregandoInicial && (
                  <span className="text-[10px] text-gray-500 px-2 py-0.5">Carregando...</span>
                )}
              </div>
            </div>

            {carregandoInicial ? (
              <p className="text-xs text-gray-500 text-center py-4">⏳ Carregando lançamentos...</p>
            ) : lancamentosFiltrados.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-2">📭 Nenhum lançamento encontrado</p>
            ) : (
              <div className="overflow-x-auto p-0.5 sm:p-1">
                <table className="min-w-full table-auto text-xs border-collapse">
                  <thead className="bg-blue-600 text-white border-b border-blue-500">
                    <tr>
                      <th className="px-1.5 py-1 text-left font-semibold uppercase text-[10px] sm:text-xs w-[75px] sm:w-auto">Data</th>
                      <th className="px-1.5 py-1 text-left font-semibold uppercase text-[10px] sm:text-xs w-[80px] sm:w-auto">Status</th>
                      <th className="px-1.5 py-1 text-right font-semibold uppercase text-[10px] sm:text-xs w-[90px] sm:w-auto">Valor</th>
                      <th className="px-1.5 py-1 text-left font-semibold uppercase text-[10px] sm:text-xs min-w-[120px]">Descrição</th>
                      <th className="px-1.5 py-1 text-left font-semibold uppercase text-[10px] sm:text-xs hidden md:table-cell">CDC</th>
                      <th className="px-1.5 py-1 text-center font-semibold uppercase text-[10px] sm:text-xs w-[80px] sm:w-auto">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lancamentosFiltrados.map((lancamento) => (
                      <tr 
                        key={lancamento.id} 
                        className="border-b hover:bg-gray-50 transition-colors bg-white"
                      >
                        <td className="px-1 py-1 whitespace-nowrap text-xs text-gray-700">
                          {formatarDataParaExibicao(lancamento.data_prevista || lancamento.data_lancamento || getDataAtualBrasil())}
                        </td>
                        <td className="px-1 py-1">
                          {lancamento.status === 'realizado' ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[12px] font-bold text-white bg-green-600">
                              ✓ Pago
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[12px] font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
                              Previsto
                            </span>
                          )}
                        </td>
                        <td className={`px-1 py-1 text-right font-medium whitespace-nowrap text-xs ${
                          lancamento.status === 'realizado' 
                            ? lancamento.tipo === 'entrada'
                              ? 'text-white font-bold bg-green-600'
                              : 'text-white font-bold bg-red-600'
                            : lancamento.tipo === 'entrada' 
                              ? 'text-green-600'
                              : 'text-red-600'
                        }`}>
                          {lancamento.tipo === 'entrada' ? '+' : '-'} R$ {lancamento.valor.toFixed(2)}
                        </td>
                        <td className="px-1 py-1 text-xs text-gray-700 truncate">
                          {lancamento.descricao}
                        </td>
                        <td className="px-1 py-1 text-xs text-gray-600 truncate hidden md:table-cell">
                          {lancamento.centros_de_custo?.nome || '-'}
                        </td>
                        <td className="px-1 py-1 text-center">
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => iniciarEdicao(lancamento)}
                              className="text-blue-500 hover:text-blue-700 font-bold"
                              title="Editar"
                            >
                              ✏️
                            </button>
                            {lancamento.status === 'previsto' && (
                              <button
                                onClick={() => setModalPagar({
                                  aberto: true,
                                  lancamento,
                                  passo: 'inicial',
                                  valorPago: null,
                                  dataPagamento: getDataAtualBrasil(),
                                  novaDataVencimento: getDataAtualBrasil(),
                                  pagarTotal: true
                                })}
                                className="text-green-500 hover:text-green-700 font-bold"
                                title="Pagar"
                              >
                                💰
                              </button>
                            )}
                            <button
                              onClick={() => setModalExcluir({aberto: true, lancamento})}
                              className="text-red-500 hover:text-red-700 font-bold"
                              title="Excluir"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}