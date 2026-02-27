import { GeradorPDFProfissional, obterConfigLogos } from './gerador-pdf-utils'

export class GeradorPDFLancamentos {
  private motor: GeradorPDFProfissional

  constructor() {
    this.motor = new GeradorPDFProfissional(obterConfigLogos())
  }

  private formatarData(dataStr: string | undefined): string {
    if (!dataStr) return 'N/A'
    try {
      const dataParte = dataStr.includes('T') ? dataStr.split('T')[0] : dataStr
      const [ano, mes, dia] = dataParte.split('-')
      return `${dia}/${mes}/${ano}`
    } catch {
      return dataStr
    }
  }

  gerarPDFLancamentosCasa(lancamentos: any[], centrosCusto: any[], filtros?: string[]) {
    const totalEntradas = lancamentos
      .filter(l => l.tipo === 'entrada')
      .reduce((sum: number, l: any) => sum + (l.valor || 0), 0)
    const totalSaidas = lancamentos
      .filter(l => l.tipo === 'saida')
      .reduce((sum: number, l: any) => sum + (l.valor || 0), 0)

    this.motor.gerarRelatorioTabular({
      titulo: 'Relatório Financeiro - Casa',
      subtitulo: `Total de ${lancamentos.length} lançamentos processados`,
      corTema: [37, 99, 235], // Blue-600
      filtros: filtros,
      colunas: ['Data', 'Descrição', 'Centro de Custo', 'Tipo', 'Valor', 'Status'],
      linhas: lancamentos.map(lanc => {
        const cdc = centrosCusto.find(c => c.id === lanc.centro_custo_id)
        return [
          this.formatarData(lanc.data_prevista || lanc.data_lancamento),
          (lanc.descricao || '').toUpperCase(),
          (cdc?.nome || '-').toUpperCase(),
          lanc.tipo.toUpperCase(),
          (lanc.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          lanc.status.toUpperCase()
        ]
      }),
      resumo: [
        { label: 'Total Entradas', valor: totalEntradas },
        { label: 'Total Saídas', valor: totalSaidas },
        { label: 'Saldo Final', valor: totalEntradas - totalSaidas }
      ]
    })

    this.motor.salvar('lancamentos_casa.pdf')
  }

  gerarPDFTransacoesLoja(transacoes: any[], titulo: string = 'Transações Loja', filtros?: string[]) {
    const totalEntradas = transacoes
      .filter(t => t.tipo === 'entrada' || t.tipo === 'venda' || t.tipo_slug === 'venda')
      .reduce((sum: number, t: any) => sum + (t.valor || t.total || 0), 0)
    
    const totalSaidas = transacoes
      .filter(t => t.tipo === 'saida' || t.tipo === 'compra' || t.tipo_slug === 'compra')
      .reduce((sum: number, t: any) => sum + (t.valor || t.total || 0), 0)

    this.motor.gerarRelatorioTabular({
      titulo: titulo.toUpperCase(),
      subtitulo: `Extrato unificado de movimentações da loja`,
      corTema: [190, 24, 93], // Pink-700
      filtros: filtros,
      colunas: ['Data', 'Cliente/Fornecedor', 'Nº Trans.', 'Tipo', 'Valor', 'Status'],
      linhas: transacoes.map(t => [
        this.formatarData(t.data_venda || t.data_compra || t.data),
        (t.cliente || t.fornecedor || t.entidade || t.cliente_fornecedor || '-').toUpperCase(),
        `#${t.numero || t.numero_transacao || '-'}`,
        (t.tipo_exibicao || t.tipo || '-').toUpperCase(),
        (t.total || t.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        (t.status_pagamento || t.status || 'PENDENTE').toUpperCase()
      ]),
      resumo: [
        { label: 'Total Entradas', valor: totalEntradas },
        { label: 'Total Saídas', valor: totalSaidas },
        { label: 'Balanço Total', valor: totalEntradas - totalSaidas }
      ]
    })

    this.motor.salvar('transacoes_loja.pdf')
  }
}
