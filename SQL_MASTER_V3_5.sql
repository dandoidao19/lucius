-- ==============================================================================
-- SCRIPT SQL NUCLEAR LUCIUS V3.5 - RESOLUÇÃO DEFINITIVA DE SCHEMA
-- EXECUTE ESTE SCRIPT NO "SQL EDITOR" DO SEU DASHBOARD SUPABASE
-- ESTE SCRIPT É SEGURO: NÃO APAGA DADOS, APENAS ADICIONA O QUE ESTÁ FALTANDO.
-- ==============================================================================

DO $$
BEGIN
    -- 1. TABELAS PRINCIPAIS (ADICIONAR COLUNA OBSERVACAO SE NÃO EXISTIR)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='observacao') THEN
        ALTER TABLE vendas ADD COLUMN observacao TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='observacao') THEN
        ALTER TABLE compras ADD COLUMN observacao TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_condicionais' AND column_name='observacao') THEN
        ALTER TABLE transacoes_condicionais ADD COLUMN observacao TEXT;
    END IF;

    -- 2. TABELA ITENS_VENDA
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_venda' AND column_name='descricao') THEN
        ALTER TABLE itens_venda ADD COLUMN descricao TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_venda' AND column_name='observacao') THEN
        ALTER TABLE itens_venda ADD COLUMN observacao TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_venda' AND column_name='categoria') THEN
        ALTER TABLE itens_venda ADD COLUMN categoria TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_venda' AND column_name='preco_custo') THEN
        ALTER TABLE itens_venda ADD COLUMN preco_custo NUMERIC(10,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_venda' AND column_name='valor_repasse') THEN
        ALTER TABLE itens_venda ADD COLUMN valor_repasse NUMERIC(10,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_venda' AND column_name='preco_venda') THEN
        ALTER TABLE itens_venda ADD COLUMN preco_venda NUMERIC(10,2) DEFAULT 0;
    END IF;

    -- 3. TABELA ITENS_COMPRA
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_compra' AND column_name='descricao') THEN
        ALTER TABLE itens_compra ADD COLUMN descricao TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_compra' AND column_name='observacao') THEN
        ALTER TABLE itens_compra ADD COLUMN observacao TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_compra' AND column_name='categoria') THEN
        ALTER TABLE itens_compra ADD COLUMN categoria TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_compra' AND column_name='preco_custo') THEN
        ALTER TABLE itens_compra ADD COLUMN preco_custo NUMERIC(10,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_compra' AND column_name='valor_repasse') THEN
        ALTER TABLE itens_compra ADD COLUMN valor_repasse NUMERIC(10,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_compra' AND column_name='preco_venda') THEN
        ALTER TABLE itens_compra ADD COLUMN preco_venda NUMERIC(10,2) DEFAULT 0;
    END IF;

    -- 4. TABELA ITENS_CONDICIONAIS (A CAUSADORA DO ERRO ATUAL)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_condicionais' AND column_name='descricao') THEN
        ALTER TABLE itens_condicionais ADD COLUMN descricao TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_condicionais' AND column_name='observacao') THEN
        ALTER TABLE itens_condicionais ADD COLUMN observacao TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_condicionais' AND column_name='categoria') THEN
        ALTER TABLE itens_condicionais ADD COLUMN categoria TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_condicionais' AND column_name='preco_custo') THEN
        ALTER TABLE itens_condicionais ADD COLUMN preco_custo NUMERIC(10,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_condicionais' AND column_name='preco_venda') THEN
        ALTER TABLE itens_condicionais ADD COLUMN preco_venda NUMERIC(10,2) DEFAULT 0;
    END IF;

END $$;

-- NOTIFICAÇÃO PARA REFRESH DO CACHE DO POSTGREST
NOTIFY pgrst, 'reload schema';
