// src/types/index.ts

export interface ItemVenda {
  id: string
  venda_id?: string
  produto_id?: string
  descricao: string
  quantidade: number
  preco_venda: number
  valor_repasse?: number
}

export interface ItemCompra {
  id: string
  compra_id?: string
  produto_id?: string
  descricao: string
  quantidade: number
  preco_custo: number
  preco_venda: number
  categoria: string
}

export interface Parcela {
  data: string
  valor: number
}

export interface Venda {
  id: string
  numero_transacao: number
  data_venda: string
  cliente: string
  total: number
  quantidade_itens: number
  status_pagamento: string
  quantidade_parcelas: number
  prazoparcelas: string
  itens?: ItemVenda[]
  parcelas?: Parcela[]
}

export interface Compra {
  id: string
  numero_transacao: number
  data_compra: string
  fornecedor: string
  total: number
  quantidade_itens: number
  status_pagamento: string
  quantidade_parcelas: number
  prazoparcelas: string
  itens?: ItemCompra[]
  parcelas?: Parcela[]
}

export interface Produto {
  id: string
  codigo: string
  descricao: string
  quantidade: number
  preco_custo: number
  valor_repasse: number
  preco_venda: number
  data_ultima_compra: string
  categoria?: string
}

export interface Filtros {
  dataInicio?: string
  dataFim?: string
  mes?: string
  descricao?: string
  status?: string
}

export interface Transacao {
  id: string
  numero_transacao: number
  data: string
  descricao: string
  valor: number
  tipo: 'entrada' | 'saida'
  status_pagamento: string
  quantidade_parcelas: number
  cliente_fornecedor: string
}

// Novo tipo para Centros de Custo
export interface CentroCusto {
  id: string;
  nome: string;
  contexto: 'casa' | 'loja';
  tipo: 'entrada' | 'saida';
  categoria: string;
  recorrencia: string;
}

// Novo tipo para Transações da Loja, mais completo que o tipo 'Transacao' genérico
export interface TransacaoLoja {
  id: string;
  data: string;
  cliente: string;
  total: number;
  tipo: 'entrada' | 'saida';
  status_pagamento: 'pago' | 'pendente' | 'parcial';
  valor_pago?: number;
  data_pagamento?: string;
  // Adicione outros campos que possam existir na tabela
  numero_transacao?: number;
  quantidade_itens?: number;
  quantidade_parcelas?: number;
  prazoparcelas?: string;
}

// Este é o tipo que o ModalPagarAvancado espera
// Agora exportado para ser usado em toda a aplicação
export interface LancamentoFinanceiro {
  id: string;
  descricao: string;
  valor: number;
  tipo: string;
  data_lancamento: string;
  data_prevista: string;
  centro_custo_id: string;
  status: string;
  parcelamento?: {
    atual: number;
    total: number;
  };
  recorrencia?: any; // Manter 'any' por enquanto para não quebrar a lógica existente
  caixa_id?: string;
  origem?: string;
  centros_de_custo?: {
    nome: string;
  } | null;
}


export interface ModalPagarState {
  aberto: boolean
  lancamento: Lancamento | null
  passo: 'confirmar_total' | 'valor_parcial' | 'nova_parcela' | 'nova_parcela_data'
  valorPago: number | null
  novaDataVencimento: string
}
