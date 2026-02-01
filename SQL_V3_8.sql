-- ==============================================================================
-- SCRIPT SQL LUCIUS V3.8 - RESOLUÇÃO DE VALORES E IMPACTO DE PEDIDOS
-- ==============================================================================

DO $$
BEGIN
    -- 1. ADICIONAR COLUNA TOTAL EM TRANSACOES_CONDICIONAIS (Para registrar valores de Pedidos)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_condicionais' AND column_name='total') THEN
        ALTER TABLE transacoes_condicionais ADD COLUMN total NUMERIC(10,2) DEFAULT 0;
    END IF;

    -- 2. GARANTIR TODAS AS COLUNAS EM ITENS_CONDICIONAIS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_condicionais' AND column_name='descricao') THEN
        ALTER TABLE itens_condicionais ADD COLUMN descricao TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_condicionais' AND column_name='valor_repasse') THEN
        ALTER TABLE itens_condicionais ADD COLUMN valor_repasse NUMERIC(10,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_condicionais' AND column_name='preco_venda') THEN
        ALTER TABLE itens_condicionais ADD COLUMN preco_venda NUMERIC(10,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_condicionais' AND column_name='categoria') THEN
        ALTER TABLE itens_condicionais ADD COLUMN categoria TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_condicionais' AND column_name='preco_custo') THEN
        ALTER TABLE itens_condicionais ADD COLUMN preco_custo NUMERIC(10,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_condicionais' AND column_name='observacao') THEN
        ALTER TABLE itens_condicionais ADD COLUMN observacao TEXT;
    END IF;

END $$;

-- ATUALIZAÇÃO DO CACHE DO SISTEMA
NOTIFY pgrst, 'reload schema';
