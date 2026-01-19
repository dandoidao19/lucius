export interface ItemCompra {
  id: string;
  produto_id: string | null;
  codigo?: string;
  descricao: string;
  quantidade: number;
  categoria: string;
  preco_custo: number;
  valor_repasse: number;
  preco_venda: number;
  minimizado?: boolean;
  isNovoCadastro?: boolean;
}

export interface ParcelaCompra {
  id: string;
  numero: number;
  data: string;
  valor: number;
  status: string;
}

export interface Compra {
  id: string;
  numero_transacao: number;
  data_compra: string;
  fornecedor: string;
  total: number;
  quantidade_itens: number;
  quantidade_parcelas: number;
  status_pagamento: string;
  prazoparcelas?: string;
  itens?: ItemCompra[];
}

export interface CompraDetalhada extends Compra {
  itens: ItemCompra[];
  parcelas: ParcelaCompra[];
  totalParcelas: number;
}

export interface ItemVenda {
  id: string;
  produto_id: string | null;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

export interface Venda {
  id: string;
  numero_transacao: number;
  data_venda: string;
  cliente: string;
  total: number;
  quantidade_itens: number;
  quantidade_parcelas: number;
  status_pagamento: string;
  prazoparcelas?: string;
  itens?: ItemVenda[];
}

export interface LancamentoFinanceiro {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: 'entrada' | 'saida';
  status: 'previsto' | 'realizado';
  centro_custo_id: string;
  caixa_id?: string;
  pago?: boolean;
  data_lancamento?: string;
  data_prevista?: string;
}

export interface CentroCusto {
  id: string;
  nome: string;
  contexto: 'casa' | 'loja';
}

export interface TransacaoLoja {
  id: string;
  data: string;
  descricao: string;
  total: number;
  tipo: 'entrada' | 'saida';
  status_pagamento: string;
  valor_pago?: number;
  data_pagamento?: string;
}
