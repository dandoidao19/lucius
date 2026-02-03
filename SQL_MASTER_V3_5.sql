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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='quantidade_parcelas') THEN
        ALTER TABLE vendas ADD COLUMN quantidade_parcelas INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='prazoparcelas') THEN
        ALTER TABLE vendas ADD COLUMN prazoparcelas TEXT DEFAULT 'mensal';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='quantidade_itens') THEN
        ALTER TABLE vendas ADD COLUMN quantidade_itens INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='observacao') THEN
        ALTER TABLE compras ADD COLUMN observacao TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='quantidade_parcelas') THEN
        ALTER TABLE compras ADD COLUMN quantidade_parcelas INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='prazoparcelas') THEN
        ALTER TABLE compras ADD COLUMN prazoparcelas TEXT DEFAULT 'mensal';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='quantidade_itens') THEN
        ALTER TABLE compras ADD COLUMN quantidade_itens INTEGER DEFAULT 0;
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

    -- 4. TABELA ITENS_CONDICIONAIS
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_condicionais' AND column_name='valor_repasse') THEN
        ALTER TABLE itens_condicionais ADD COLUMN valor_repasse NUMERIC(10,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_condicionais' AND column_name='status') THEN
        ALTER TABLE itens_condicionais ADD COLUMN status TEXT DEFAULT 'pendente';
    END IF;

    -- 5. TABELA TRANSACOES_LOJA (VINCULOS)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_loja' AND column_name='id_venda') THEN
        ALTER TABLE transacoes_loja ADD COLUMN id_venda UUID REFERENCES vendas(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_loja' AND column_name='id_compra') THEN
        ALTER TABLE transacoes_loja ADD COLUMN id_compra UUID REFERENCES compras(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_loja' AND column_name='id_condicional') THEN
        ALTER TABLE transacoes_loja ADD COLUMN id_condicional UUID REFERENCES transacoes_condicionais(id) ON DELETE CASCADE;
    END IF;

    -- 6. PERSISTENCIA FINANCEIRA EM PEDIDOS (TRANSACOES_CONDICIONAIS)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_condicionais' AND column_name='quantidade_parcelas') THEN
        ALTER TABLE transacoes_condicionais ADD COLUMN quantidade_parcelas INTEGER DEFAULT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_condicionais' AND column_name='prazoparcelas') THEN
        ALTER TABLE transacoes_condicionais ADD COLUMN prazoparcelas TEXT DEFAULT 'mensal';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_condicionais' AND column_name='data_vencimento') THEN
        ALTER TABLE transacoes_condicionais ADD COLUMN data_vencimento DATE;
    END IF;

END $$;

-- 7. FUNÇÃO DE ATUALIZAÇÃO DE ESTOQUE (CORREÇÃO UUID/INTEGER)
CREATE OR REPLACE FUNCTION public.atualizar_estoque(produto_id_param UUID, quantidade_param INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.produtos SET quantidade = quantidade + quantidade_param WHERE id = produto_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NOTIFICAÇÃO PARA REFRESH DO CACHE DO POSTGREST
NOTIFY pgrst, 'reload schema';
