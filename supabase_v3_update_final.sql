-- =========================================================
-- SCRIPT DE ATUALIZAÇÃO COMPLETO - LUCIUS v3.0 (REFORÇADO)
-- =========================================================

-- 1. ADICIONAR COLUNA OBSERVACAO NAS TABELAS PRINCIPAIS
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS observacao TEXT;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS observacao TEXT;
ALTER TABLE transacoes_loja ADD COLUMN IF NOT EXISTS observacao TEXT;
ALTER TABLE transacoes_condicionais ADD COLUMN IF NOT EXISTS observacao TEXT;

-- 2. ATUALIZAR ITENS_VENDA
ALTER TABLE itens_venda ADD COLUMN IF NOT EXISTS observacao TEXT;
ALTER TABLE itens_venda ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE itens_venda ADD COLUMN IF NOT EXISTS preco_custo DECIMAL(10,2) DEFAULT 0;
ALTER TABLE itens_venda ADD COLUMN IF NOT EXISTS valor_repasse DECIMAL(10,2) DEFAULT 0;

-- 3. ATUALIZAR ITENS_COMPRA
ALTER TABLE itens_compra ADD COLUMN IF NOT EXISTS observacao TEXT;
ALTER TABLE itens_compra ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE itens_compra ADD COLUMN IF NOT EXISTS preco_custo DECIMAL(10,2) DEFAULT 0;
ALTER TABLE itens_compra ADD COLUMN IF NOT EXISTS valor_repasse DECIMAL(10,2) DEFAULT 0;
ALTER TABLE itens_compra ADD COLUMN IF NOT EXISTS preco_venda DECIMAL(10,2) DEFAULT 0;

-- 4. ATUALIZAR ITENS_CONDICIONAIS
ALTER TABLE itens_condicionais ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE itens_condicionais ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE itens_condicionais ADD COLUMN IF NOT EXISTS observacao TEXT;
ALTER TABLE itens_condicionais ADD COLUMN IF NOT EXISTS preco_custo DECIMAL(10,2) DEFAULT 0;
ALTER TABLE itens_condicionais ADD COLUMN IF NOT EXISTS preco_venda DECIMAL(10,2) DEFAULT 0;

-- 5. GARANTIR QUE OS NÚMEROS DE TRANSAÇÃO EXISTAM (OPCIONAL)
-- ALTER TABLE transacoes_loja ADD COLUMN IF NOT EXISTS numero_transacao INTEGER;

-- REFRESH SCHEMA CACHE: Após executar no SQL Editor, recarregue a página do sistema.
