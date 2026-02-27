/**
 * Utilitário Profissional para geração de PDFs LUCIUS v5.7
 * Utiliza jsPDF e jspdf-autotable para criar documentos de alta qualidade
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// --- Tipagens ---

export interface LogoConfig {
  logoEmpresa?: string
  logoCliente?: string
  nomeEmpresa: string
  nomeSistema: string
}

export interface ItemPDF {
  codigo?: string
  descricao: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
  categoria?: string
}

export interface ParcelaPDF {
  numero: number
  data: string
  valor: number
  status: string
}

export interface DadosPDF {
  tipo: 'compra' | 'venda' | 'estoque' | 'financeiro' | 'casa' | 'pedido' | 'condicional'
  titulo: string
  numero?: number
  data: string
  entidade?: string
  itens?: ItemPDF[]
  parcelas?: ParcelaPDF[]
  total: number
  totalSecundario?: number // Ex: Saldo ou Total Saídas
  observacoes?: string
  filtros?: string[]
  corTema?: [number, number, number] // RGB
}

// --- Classe Principal ---

export class GeradorPDFProfissional {
  private doc: jsPDF
  private config: LogoConfig
  private margem = 14
  private larguraUtil = 182 // 210 - 28
  private y = 15
  private corTema: [number, number, number] = [76, 29, 149] // Purple-900 padrão

  constructor(config?: LogoConfig) {
    this.doc = new jsPDF('p', 'mm', 'a4')
    this.config = config || {
      nomeEmpresa: 'SISTEMA LUCIUS',
      nomeSistema: 'LUCIUS v5.7'
    }
  }

  private setCorTema(cor?: [number, number, number]) {
    if (cor) this.corTema = cor
  }

  // --- Componentes de Layout ---

  private desenharCabecalho(titulo: string, subtitulo?: string) {
    const { logoEmpresa, nomeSistema } = this.config
    
    // Fundo do Cabeçalho (Barra Superior)
    this.doc.setFillColor(this.corTema[0], this.corTema[1], this.corTema[2])
    this.doc.rect(0, 0, 210, 35, 'F')

    // Logo ou Nome do Sistema
    this.doc.setTextColor(255, 255, 255)
    if (logoEmpresa) {
      try {
        this.doc.addImage(logoEmpresa, 'PNG', this.margem, 8, 25, 12)
      } catch {
        this.doc.setFontSize(22)
        this.doc.setFont('helvetica', 'bold')
        this.doc.text(nomeSistema, this.margem, 18)
      }
    } else {
      this.doc.setFontSize(22)
      this.doc.setFont('helvetica', 'bold')
      this.doc.text(nomeSistema, this.margem, 18)
    }

    // Título do Documento (Direita)
    this.doc.setFontSize(14)
    this.doc.text(titulo.toUpperCase(), 210 - this.margem, 18, { align: 'right' })
    
    if (subtitulo) {
      this.doc.setFontSize(9)
      this.doc.setFont('helvetica', 'normal')
      this.doc.text(subtitulo, 210 - this.margem, 24, { align: 'right' })
    }

    // Data de Emissão
    this.doc.setFontSize(8)
    this.doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, 210 - this.margem, 30, { align: 'right' })

    this.y = 45
  }

  private desenharInfoBasica(labels: { label: string, valor: string }[]) {
    this.doc.setFontSize(9)
    this.doc.setTextColor(50, 50, 50)

    let xPos = this.margem
    const larguraColuna = this.larguraUtil / labels.length

    labels.forEach(item => {
      this.doc.setFont('helvetica', 'bold')
      this.doc.text(item.label.toUpperCase(), xPos, this.y)
      this.doc.setFont('helvetica', 'normal')
      this.doc.text(item.valor, xPos, this.y + 5)
      xPos += larguraColuna
    })

    this.y += 15
    this.doc.setDrawColor(230, 230, 230)
    this.doc.line(this.margem, this.y - 5, 210 - this.margem, this.y - 5)
  }

  private desenharFiltros(filtros?: string[]) {
    if (!filtros || filtros.length === 0) return

    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'bold')
    this.doc.setTextColor(100, 100, 100)
    this.doc.text('FILTROS APLICADOS:', this.margem, this.y)
    
    this.doc.setFont('helvetica', 'normal')
    const textoFiltros = filtros.join(' | ')
    const splitFiltros = this.doc.splitTextToSize(textoFiltros, this.larguraUtil)
    this.doc.text(splitFiltros, this.margem, this.y + 4)
    
    this.y += (splitFiltros.length * 4) + 6
  }

  private desenharRodape() {
    const totalPaginas = (this.doc as any).internal.getNumberOfPages()
    
    for (let i = 1; i <= totalPaginas; i++) {
      this.doc.setPage(i)
      this.doc.setFontSize(8)
      this.doc.setTextColor(150, 150, 150)

      // Linha superior do rodapé
      this.doc.setDrawColor(240, 240, 240)
      this.doc.line(this.margem, 282, 210 - this.margem, 282)

      // Texto do rodapé
      this.doc.text(
        `${this.config.nomeEmpresa} - Gestão Inteligente Lucius`,
        this.margem,
        287
      )

      this.doc.text(
        `Página ${i} de ${totalPaginas}`,
        210 - this.margem,
        287,
        { align: 'right' }
      )
    }
  }

  private formatarMoeda(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  // --- Métodos de Geração ---

  public gerarDocumento(dados: DadosPDF) {
    this.setCorTema(dados.corTema)
    
    const subtitulo = dados.numero ? `Nº Transação: #${dados.numero}` : dados.entidade
    this.desenharCabecalho(dados.titulo, subtitulo)

    const infos = [
      { label: 'Data do Documento', valor: new Date(dados.data + 'T12:00:00').toLocaleDateString('pt-BR') },
      { label: 'Valor Principal', valor: this.formatarMoeda(dados.total) }
    ]
    if (dados.totalSecundario !== undefined) {
      const labelSecundario = dados.tipo === 'casa' ? 'Saldo Final' : 'Saldo / Outros'
      infos.push({ label: labelSecundario, valor: this.formatarMoeda(dados.totalSecundario) })
    }
    this.desenharInfoBasica(infos)
    this.desenharFiltros(dados.filtros)

    // Tabela de Itens (se houver)
    if (dados.itens && dados.itens.length > 0) {
      const isEstoque = dados.tipo === 'estoque'
      const head = isEstoque
        ? [['CÓDIGO', 'DESCRIÇÃO', 'QTD', 'UNITÁRIO (VENDA)', 'SUBTOTAL']]
        : [['CÓDIGO', 'DESCRIÇÃO', 'QTD', 'UNITÁRIO', 'TOTAL']]

      autoTable(this.doc, {
        startY: this.y,
        head: head,
        body: dados.itens.map(it => [
          it.codigo || '-',
          it.descricao.toUpperCase(),
          it.quantidade,
          this.formatarMoeda(it.valorUnitario),
          this.formatarMoeda(it.valorTotal)
        ]),
        theme: 'striped',
        headStyles: { fillColor: this.corTema, fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 25 },
          2: { halign: 'center', cellWidth: 15 },
          3: { halign: 'right', cellWidth: 30 },
          4: { halign: 'right', cellWidth: 30 },
        },
        margin: { left: this.margem, right: this.margem }
      })
      this.y = (this.doc as any).lastAutoTable.finalY + 10
    }

    // Tabela de Parcelas (se houver)
    if (dados.parcelas && dados.parcelas.length > 0) {
      if (this.y > 240) this.doc.addPage()

      this.doc.setFontSize(10)
      this.doc.setFont('helvetica', 'bold')
      this.doc.setTextColor(this.corTema[0], this.corTema[1], this.corTema[2])
      this.doc.text('CRONOGRAMA FINANCEIRO', this.margem, this.y)
      this.y += 5

      autoTable(this.doc, {
        startY: this.y,
        head: [['PARCELA', 'VENCIMENTO', 'VALOR', 'STATUS']],
        body: dados.parcelas.map(p => [
          `${p.numero}ª Parcela`,
          new Date(p.data + 'T12:00:00').toLocaleDateString('pt-BR'),
          this.formatarMoeda(p.valor),
          p.status.toUpperCase()
        ]),
        theme: 'grid',
        headStyles: { fillColor: [100, 100, 100], fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: this.margem, right: this.margem },
        didParseCell: (data) => {
          if (data.column.index === 3) {
            if (data.cell.text[0] === 'PAGO') data.cell.styles.textColor = [34, 139, 34]
            if (data.cell.text[0] === 'PENDENTE') data.cell.styles.textColor = [200, 0, 0]
          }
        }
      })
      this.y = (this.doc as any).lastAutoTable.finalY + 10
    }

    // Observações
    if (dados.observacoes) {
      if (this.y > 260) this.doc.addPage()
      this.doc.setFontSize(8)
      this.doc.setFont('helvetica', 'bold')
      this.doc.setTextColor(100, 100, 100)
      this.doc.text('OBSERVAÇÕES:', this.margem, this.y)
      this.doc.setFont('helvetica', 'normal')
      const lines = this.doc.splitTextToSize(dados.observacoes, this.larguraUtil)
      this.doc.text(lines, this.margem, this.y + 4)
    }

    this.desenharRodape()
  }

  public gerarRelatorioTabular(dados: {
    titulo: string,
    subtitulo: string,
    filtros?: string[],
    colunas: string[],
    linhas: any[][],
    resumo: { label: string, valor: number }[],
    corTema?: [number, number, number]
  }) {
    this.setCorTema(dados.corTema)
    this.desenharCabecalho(dados.titulo, dados.subtitulo)
    this.desenharFiltros(dados.filtros)

    autoTable(this.doc, {
      startY: this.y,
      head: [dados.colunas.map(c => c.toUpperCase())],
      body: dados.linhas,
      theme: 'striped',
      headStyles: { fillColor: this.corTema, fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 1.5 },
      margin: { left: this.margem, right: this.margem },
      didParseCell: (data) => {
        // Estilização dinâmica baseada no conteúdo
        const text = String(data.cell.text).toUpperCase()
        if (text === 'PAGO' || text === 'ENTRADA' || text === 'VENDA' || text === 'RECEBIDO') {
          data.cell.styles.textColor = [0, 100, 0]
          data.cell.styles.fontStyle = 'bold'
        }
        if (text === 'PENDENTE' || text === 'SAÍDA' || text === 'COMPRA' || text === 'ENVIADO') {
          data.cell.styles.textColor = [150, 0, 0]
          data.cell.styles.fontStyle = 'bold'
        }
      }
    })

    this.y = (this.doc as any).lastAutoTable.finalY + 10

    // Resumo Final
    if (this.y > 250) this.doc.addPage()
    
    let xResumo = 210 - this.margem
    dados.resumo.reverse().forEach(item => {
      this.doc.setFontSize(10)
      this.doc.setFont('helvetica', 'bold')
      this.doc.setTextColor(50, 50, 50)
      const texto = `${item.label}: ${this.formatarMoeda(item.valor)}`
      this.doc.text(texto, xResumo, this.y, { align: 'right' })
      this.y += 6
    })

    this.desenharRodape()
  }

  public salvar(nome: string) {
    this.doc.save(nome.endsWith('.pdf') ? nome : `${nome}.pdf`)
  }
}

// --- Compatibilidade v5.4 -> v5.7 ---

/** @deprecated Use GeradorPDFProfissional */
export class GeradorPDF extends GeradorPDFProfissional {
  constructor(config: LogoConfig) {
    super(config)
  }

  // Wrapper para compatibilidade com código antigo
  gerarRelatorioFinanceiro(dados: any) {
    this.gerarRelatorioTabular({
      titulo: 'RELATÓRIO FINANCEIRO',
      subtitulo: `Total de ${dados.transacoes.length} transações`,
      corTema: [21, 128, 61], // Green-700
      filtros: dados.filtrosAplicados,
      colunas: ['Vencimento', 'Transação', 'Entidade', 'Valor', 'Parcela', 'Tipo', 'Status'],
      linhas: dados.transacoes.map((t: any) => [
        new Date(t.vencimento + 'T12:00:00').toLocaleDateString('pt-BR'),
        `#${t.transacao}`,
        t.clienteFornecedor.toUpperCase(),
        t.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        t.parcela,
        t.tipo,
        t.status.toUpperCase()
      ]),
      resumo: [{ label: 'TOTAL GERAL', valor: dados.totalGeral }]
    })
  }

  /** @deprecated */
  gerarOrdemCompra(dados: any) {
     this.gerarDocumento({
        tipo: 'estoque',
        titulo: 'RELATÓRIO DE ESTOQUE',
        data: dados.data,
        corTema: [185, 28, 28],
        itens: dados.itens,
        total: dados.total,
        filtros: dados.filtrosAplicados,
        observacoes: dados.observacoes
     })
  }
}

export async function imagemParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Helper para obter configuração de logos
export function obterConfigLogos(): LogoConfig {
  const logoEmpresa = typeof window !== 'undefined' ? localStorage.getItem('logo_empresa') || undefined : undefined
  const logoCliente = typeof window !== 'undefined' ? localStorage.getItem('logo_cliente') || undefined : undefined
  const nomeEmpresa = typeof window !== 'undefined' ? localStorage.getItem('nome_empresa') || 'SUA EMPRESA' : 'SUA EMPRESA'
  
  return {
    logoEmpresa,
    logoCliente,
    nomeEmpresa,
    nomeSistema: 'LUCIUS v5.7'
  }
}

export function salvarConfigLogos(config: Partial<LogoConfig>): void {
  if (config.logoEmpresa) {
    localStorage.setItem('logo_empresa', config.logoEmpresa)
  }
  if (config.logoCliente) {
    localStorage.setItem('logo_cliente', config.logoCliente)
  }
  if (config.nomeEmpresa) {
    localStorage.setItem('nome_empresa', config.nomeEmpresa)
  }
}
