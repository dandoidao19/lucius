import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { LancamentoFinanceiro, CentroCusto, Venda, Compra, TransacaoUnificada } from '@/types'
import { formatarDataParaExibicao } from './dateUtils'

export class GeradorPDFLancamentos {
  private doc: jsPDF

  constructor() {
    this.doc = new jsPDF()
  }

  // Função auxiliar para formatar data usando o utilitário padrão do sistema
  private formatarData(dataStr: string | undefined): string {
    if (!dataStr) return 'N/A'
    return formatarDataParaExibicao(dataStr) || 'N/A'
  }

  // Gerar PDF de lançamentos da casa
  gerarPDFLancamentosCasa(lancamentos: LancamentoFinanceiro[], centrosCusto: CentroCusto[]) {
    this.doc = new jsPDF()
    
    // Cabeçalho
    this.doc.setFontSize(16)
    this.doc.text('Relatório de Lançamentos - Casa', 14, 15)
    
    this.doc.setFontSize(10)
    this.doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 22)
    this.doc.text(`Total de lançamentos: ${lancamentos.length}`, 14, 28)
    
    // Calcular totais
    const totalEntradas = lancamentos
      .filter(l => l.tipo === 'entrada')
      .reduce((sum: number, l: any) => sum + (l.valor || 0), 0)
    
    const totalSaidas = lancamentos
      .filter(l => l.tipo === 'saida')
      .reduce((sum: number, l: any) => sum + (l.valor || 0), 0)
    
    const saldo = totalEntradas - totalSaidas
    
    this.doc.setFontSize(11)
    this.doc.setTextColor(34, 139, 34)
    this.doc.text(`Total Entradas: R$ ${totalEntradas.toFixed(2)}`, 14, 34)
    
    this.doc.setTextColor(220, 20, 60)
    this.doc.text(`Total Saídas: R$ ${totalSaidas.toFixed(2)}`, 14, 40)
    
    this.doc.setTextColor(0, 0, 0)
    this.doc.text(`Saldo: R$ ${saldo.toFixed(2)}`, 14, 46)
    
    // Tabela de lançamentos
    const dados = lancamentos.map(lanc => {
      const cdc = centrosCusto.find(c => c.id === lanc.centro_custo_id)
      const dataFormatada = this.formatarData(lanc.data_prevista || lanc.data_lancamento)
      
      return [
        dataFormatada,
        (lanc.descricao || '-').substring(0, 30),
        cdc?.nome || '-',
        lanc.tipo === 'entrada' ? 'Entrada' : 'Saída',
        `R$ ${(lanc.valor || 0).toFixed(2)}`,
        lanc.status || 'pendente'
      ]
    })

    autoTable(this.doc, {
      head: [['Data', 'Descrição', 'Centro de Custo', 'Tipo', 'Valor', 'Status']],
      body: dados,
      startY: 52,
      theme: 'grid',
      styles: { fontSize: 9 }
    })

    this.doc.save('lancamentos_casa.pdf')
  }

  // Gerar PDF de vendas
  gerarPDFVendas(vendas: Venda[]) {
    this.doc = new jsPDF()
    
    this.doc.setFontSize(16)
    this.doc.text('Relatório de Vendas', 14, 15)
    
    this.doc.setFontSize(10)
    this.doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 22)
    this.doc.text(`Total de vendas: ${vendas.length}`, 14, 28)
    
    const totalVendas = vendas.reduce((sum: number, v: any) => sum + (v.total || 0), 0)
    
    this.doc.setFontSize(11)
    this.doc.setTextColor(34, 139, 34)
    this.doc.text(`Total: R$ ${totalVendas.toFixed(2)}`, 14, 34)
    this.doc.setTextColor(0, 0, 0)
    
    const dados = vendas.map(venda => [
      this.formatarData(venda.data_venda),
      (venda.cliente || '-').substring(0, 25),
      venda.numero_transacao || '-',
      `R$ ${(venda.total || 0).toFixed(2)}`,
      venda.status_pagamento || 'pendente',
      venda.quantidade_parcelas || 1
    ])

    autoTable(this.doc, {
      head: [['Data', 'Cliente', 'Nº Trans.', 'Total', 'Status', 'Parcelas']],
      body: dados,
      startY: 40,
      theme: 'grid',
      styles: { fontSize: 9 }
    })

    this.doc.save('vendas.pdf')
  }

  // Gerar PDF de compras
  gerarPDFCompras(compras: Compra[]) {
    this.doc = new jsPDF()
    
    this.doc.setFontSize(16)
    this.doc.text('Relatório de Compras', 14, 15)
    
    this.doc.setFontSize(10)
    this.doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 22)
    this.doc.text(`Total de compras: ${compras.length}`, 14, 28)
    
    const totalCompras = compras.reduce((sum: number, c: any) => sum + (c.total || 0), 0)
    
    this.doc.setFontSize(11)
    this.doc.setTextColor(220, 20, 60)
    this.doc.text(`Total: R$ ${totalCompras.toFixed(2)}`, 14, 34)
    this.doc.setTextColor(0, 0, 0)
    
    const dados = compras.map(compra => [
      this.formatarData(compra.data_compra),
      (compra.fornecedor || '-').substring(0, 25),
      compra.numero_transacao || '-',
      `R$ ${(compra.total || 0).toFixed(2)}`,
      compra.status_pagamento || 'pendente',
      compra.quantidade_parcelas || 1
    ])

    autoTable(this.doc, {
      head: [['Data', 'Fornecedor', 'Nº Trans.', 'Total', 'Status', 'Parcelas']],
      body: dados,
      startY: 40,
      theme: 'grid',
      styles: { fontSize: 9 }
    })

    this.doc.save('compras.pdf')
  }

  // Gerar PDF de transações da loja (CORRIGIDO)
  gerarPDFTransacoesLoja(transacoes: any[], titulo: string = 'Transações Loja') {
    this.doc = new jsPDF()
    
    this.doc.setFontSize(16)
    this.doc.text(titulo, 14, 15)
    
    this.doc.setFontSize(10)
    this.doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 22)
    this.doc.text(`Total de transações: ${transacoes.length}`, 14, 28)
    
    // Calcular totais
    const totalEntradas = transacoes
      .filter((t: any) => t.tipo === 'entrada' || t.tipo === 'venda' || t.tipo_slug === 'venda' || t.tipo_slug === 'pedido_venda')
      .reduce((sum: number, t: any) => sum + (t.valor || t.total || 0), 0)
    
    const totalSaidas = transacoes
      .filter((t: any) => t.tipo === 'saida' || t.tipo === 'compra' || t.tipo_slug === 'compra' || t.tipo_slug === 'pedido_compra')
      .reduce((sum: number, t: any) => sum + (t.valor || t.total || 0), 0)
    
    const saldo = totalEntradas - totalSaidas
    
    this.doc.setFontSize(11)
    this.doc.setTextColor(34, 139, 34)
    this.doc.text(`Total Entradas: R$ ${totalEntradas.toFixed(2)}`, 14, 34)
    
    this.doc.setTextColor(220, 20, 60)
    this.doc.text(`Total Saídas: R$ ${totalSaidas.toFixed(2)}`, 14, 40)
    
    this.doc.setTextColor(0, 0, 0)
    this.doc.text(`Saldo: R$ ${saldo.toFixed(2)}`, 14, 46)
    
    // Tabela de transações - CORRIGIDO COM VALIDAÇÃO
    const dados = transacoes.map((trans: any) => {
      // Validação segura da data
      const dataFormatada = this.formatarData(
        trans.data_venda || trans.data_compra || trans.data || trans.data_pedido || trans.data_transacao
      )
      
      const entidade = trans.cliente || trans.fornecedor || trans.entidade || trans.origem || trans.cliente_fornecedor || '-'
      const numero = trans.numero_transacao || trans.numero || '-'
      const tipoExibicao = trans.tipo_exibicao || (trans.tipo === 'venda' || trans.tipo === 'entrada' ? 'Venda' : 'Compra')
      const total = trans.total || trans.valor || trans.total_geral || 0
      const status = trans.status_pagamento || trans.status || 'pendente'

      return [
        dataFormatada,
        String(entidade).substring(0, 25),
        numero,
        tipoExibicao,
        `R$ ${Number(total).toFixed(2)}`,
        String(status).toUpperCase()
      ]
    })

    autoTable(this.doc, {
      head: [['Data', 'Cliente/Fornecedor', 'Nº Trans.', 'Tipo', 'Valor', 'Status']],
      body: dados,
      startY: 52,
      theme: 'grid',
      styles: { fontSize: 9 }
    })

    this.doc.save('transacoes_loja.pdf')
  }
}
