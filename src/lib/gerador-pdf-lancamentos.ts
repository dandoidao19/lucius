import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

type LancamentoPDF = {
  tipo?: string
  valor?: number
  descricao?: string
  centro_custo_id?: string
  data_prevista?: string
  data_lancamento?: string
  status?: string
}

type CentroCustoPDF = {
  id: string
  nome?: string
}

type VendaPDF = {
  data_venda?: string
  cliente?: string
  numero_transacao?: string
  total?: number
  status_pagamento?: string
  quantidade_parcelas?: number
}

type CompraPDF = {
  data_compra?: string
  fornecedor?: string
  numero_transacao?: string
  total?: number
  status_pagamento?: string
  quantidade_parcelas?: number
}

export class GeradorPDFLancamentos {
  private doc: jsPDF

  constructor() {
    this.doc = new jsPDF()
  }

  // Função auxiliar para formatar data
  private formatarData(dataStr: string | undefined): string {
    if (!dataStr) return 'N/A'
    
    try {
      // Remove 'T' e pega apenas a data
      const dataParte = dataStr.includes('T') ? dataStr.split('T')[0] : dataStr
      const [ano, mes, dia] = dataParte.split('-')
      return `${dia}/${mes}/${ano}`
    } catch {
      return dataStr
    }
  }

  private formatarMoedaPDF(valor: number | undefined): string {
    const numero = Number(valor ?? 0)
    return numero.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  // Gerar PDF de lançamentos da casa
  gerarPDFLancamentosCasa(lancamentos: LancamentoPDF[], centrosCusto: CentroCustoPDF[]) {
    this.doc = new jsPDF()
    
    // Cabeçalho
    this.doc.setFontSize(16)
    this.doc.text('Relatório de Lançamentos - Casa', 14, 15)
    
    this.doc.setFontSize(10)
    this.doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 22)
    this.doc.text(`Total de lançamentos: ${lancamentos.length}`, 14, 28)
    
    // Calcular totais
    const totalEntradas = lancamentos
      .filter((l) => l.tipo === 'entrada')
      .reduce((sum: number, l) => sum + (l.valor || 0), 0)
    
    const totalSaidas = lancamentos
      .filter((l) => l.tipo === 'saida')
      .reduce((sum: number, l) => sum + (l.valor || 0), 0)
    
    const saldo = totalEntradas - totalSaidas
    
    this.doc.setFontSize(11)
    this.doc.setTextColor(34, 139, 34)
    this.doc.text(`Total Entradas: ${this.formatarMoedaPDF(totalEntradas)}`, 14, 34)
    
    this.doc.setTextColor(220, 20, 60)
    this.doc.text(`Total Saídas: ${this.formatarMoedaPDF(totalSaidas)}`, 14, 40)
    
    this.doc.setTextColor(0, 0, 0)
    this.doc.text(`Saldo: ${this.formatarMoedaPDF(saldo)}`, 14, 46)
    
    // Tabela de lançamentos
    const dados = lancamentos.map((lanc) => {
      const cdc = centrosCusto.find((c) => c.id === lanc.centro_custo_id)
      const dataFormatada = this.formatarData(lanc.data_prevista || lanc.data_lancamento)

      return {
        data: dataFormatada,
        descricao: (lanc.descricao || '-').substring(0, 30),
        centroCusto: cdc?.nome || '-',
        tipo: lanc.tipo === 'entrada' ? 'Entrada' : 'Saída',
        valor: this.formatarMoedaPDF(lanc.valor),
        status: lanc.status || 'pendente',
        tipoRaw: lanc.tipo ?? '',
      }
    })

    autoTable(this.doc, {
      columns: [
        { header: 'Data', dataKey: 'data' },
        { header: 'Descrição', dataKey: 'descricao' },
        { header: 'Centro de Custo', dataKey: 'centroCusto' },
        { header: 'Tipo', dataKey: 'tipo' },
        { header: 'Valor', dataKey: 'valor' },
        { header: 'Status', dataKey: 'status' },
      ],
      body: dados,
      startY: 52,
      theme: 'grid',
      styles: { fontSize: 9 },
      columnStyles: {
        valor: { halign: 'right' },
      },
      didParseCell: (data) => {
        const dataKey = (data.column as { dataKey?: string }).dataKey
        if (data.section === 'body' && dataKey === 'valor') {
          const tipoRaw = (data.row.raw as { tipoRaw?: string }).tipoRaw
          data.cell.styles.textColor = tipoRaw === 'entrada' ? [34, 139, 34] : [220, 20, 60]
        }
      },
    })

    this.doc.save('lancamentos_casa.pdf')
  }

  // Gerar PDF de vendas
  gerarPDFVendas(vendas: VendaPDF[]) {
    this.doc = new jsPDF()
    
    this.doc.setFontSize(16)
    this.doc.text('Relatório de Vendas', 14, 15)
    
    this.doc.setFontSize(10)
    this.doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 22)
    this.doc.text(`Total de vendas: ${vendas.length}`, 14, 28)
    
    const totalVendas = vendas.reduce((sum: number, v) => sum + (v.total || 0), 0)
    
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
  gerarPDFCompras(compras: CompraPDF[]) {
    this.doc = new jsPDF()
    
    this.doc.setFontSize(16)
    this.doc.text('Relatório de Compras', 14, 15)
    
    this.doc.setFontSize(10)
    this.doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 22)
    this.doc.text(`Total de compras: ${compras.length}`, 14, 28)
    
    const totalCompras = compras.reduce((sum: number, c) => sum + (c.total || 0), 0)
    
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

}
