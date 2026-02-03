-- ==============================================================================
-- SCRIPT SQL NUCLEAR LUCIUS V3.5 - RESOLUÇÃO DEFINITIVA DE SCHEMA
-- EXECUTE ESTE SCRIPT NO "SQL EDITOR" DO SEU DASHBOARD SUPABASE
-- ESTE SCRIPT É SEGURO: NÃO APAGA DADOS, APENAS ADICIONA O QUE ESTÁ FALTANDO.
-- ==============================================================================

DO $$
BEGIN
    -- 1. COLUNAS DE USUÁRIO (user_id) - Essencial para RLS e Autenticação
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='user_id') THEN
        ALTER TABLE vendas ADD COLUMN user_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='user_id') THEN
        ALTER TABLE compras ADD COLUMN user_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_condicionais' AND column_name='user_id') THEN
        ALTER TABLE transacoes_condicionais ADD COLUMN user_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='produtos' AND column_name='user_id') THEN
        ALTER TABLE produtos ADD COLUMN user_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_loja' AND column_name='user_id') THEN
        ALTER TABLE transacoes_loja ADD COLUMN user_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_loja' AND column_name='observacao') THEN
        ALTER TABLE transacoes_loja ADD COLUMN observacao TEXT;
    END IF;

    -- 2. TABELAS PRINCIPAIS (VENDAS / COMPRAS / CONDICIONAIS)
    -- Vendas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='observacao') THEN
        ALTER TABLE vendas ADD COLUMN observacao TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='quantidade_parcelas') THEN
        ALTER TABLE vendas ADD COLUMN quantidade_parcelas INTEGER DEFAULT 1;
    ELSE
        ALTER TABLE vendas ALTER COLUMN quantidade_parcelas SET DEFAULT 1;
    END IF;
    UPDATE vendas SET quantidade_parcelas = 1 WHERE quantidade_parcelas IS NULL;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='prazoparcelas') THEN
        ALTER TABLE vendas ADD COLUMN prazoparcelas TEXT DEFAULT 'mensal';
    ELSE
        ALTER TABLE vendas ALTER COLUMN prazoparcelas SET DEFAULT 'mensal';
    END IF;
    UPDATE vendas SET prazoparcelas = 'mensal' WHERE prazoparcelas IS NULL;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='quantidade_itens') THEN
        ALTER TABLE vendas ADD COLUMN quantidade_itens INTEGER DEFAULT 0;
    ELSE
        ALTER TABLE vendas ALTER COLUMN quantidade_itens SET DEFAULT 0;
    END IF;
    UPDATE vendas SET quantidade_itens = 0 WHERE quantidade_itens IS NULL;

    -- Compras
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='observacao') THEN
        ALTER TABLE compras ADD COLUMN observacao TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='quantidade_parcelas') THEN
        ALTER TABLE compras ADD COLUMN quantidade_parcelas INTEGER DEFAULT 1;
    ELSE
        ALTER TABLE compras ALTER COLUMN quantidade_parcelas SET DEFAULT 1;
    END IF;
    UPDATE compras SET quantidade_parcelas = 1 WHERE quantidade_parcelas IS NULL;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='prazoparcelas') THEN
        ALTER TABLE compras ADD COLUMN prazoparcelas TEXT DEFAULT 'mensal';
    ELSE
        ALTER TABLE compras ALTER COLUMN prazoparcelas SET DEFAULT 'mensal';
    END IF;
    UPDATE compras SET prazoparcelas = 'mensal' WHERE prazoparcelas IS NULL;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='quantidade_itens') THEN
        ALTER TABLE compras ADD COLUMN quantidade_itens INTEGER DEFAULT 0;
    ELSE
        ALTER TABLE compras ALTER COLUMN quantidade_itens SET DEFAULT 0;
    END IF;
    UPDATE compras SET quantidade_itens = 0 WHERE quantidade_itens IS NULL;

    -- Condicionais / Pedidos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_condicionais' AND column_name='observacao') THEN
        ALTER TABLE transacoes_condicionais ADD COLUMN observacao TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_condicionais' AND column_name='quantidade_parcelas') THEN
        ALTER TABLE transacoes_condicionais ADD COLUMN quantidade_parcelas INTEGER DEFAULT 1;
    ELSE
        ALTER TABLE transacoes_condicionais ALTER COLUMN quantidade_parcelas SET DEFAULT 1;
    END IF;
    UPDATE transacoes_condicionais SET quantidade_parcelas = 1 WHERE quantidade_parcelas IS NULL;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_condicionais' AND column_name='prazoparcelas') THEN
        ALTER TABLE transacoes_condicionais ADD COLUMN prazoparcelas TEXT DEFAULT 'mensal';
    ELSE
        ALTER TABLE transacoes_condicionais ALTER COLUMN prazoparcelas SET DEFAULT 'mensal';
    END IF;
    UPDATE transacoes_condicionais SET prazoparcelas = 'mensal' WHERE prazoparcelas IS NULL;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_condicionais' AND column_name='data_vencimento') THEN
        ALTER TABLE transacoes_condicionais ADD COLUMN data_vencimento DATE;
    END IF;

    -- 3. TABELAS DE ITENS
    -- Itens Venda
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

    -- Itens Compra
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

    -- Itens Condicionais
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
    ELSE
        ALTER TABLE itens_condicionais ALTER COLUMN status SET DEFAULT 'pendente';
    END IF;
    UPDATE itens_condicionais SET status = 'pendente' WHERE status IS NULL;

    -- 4. TABELA TRANSACOES_LOJA (VINCULOS DE UUID)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_loja' AND column_name='id_venda') THEN
        ALTER TABLE transacoes_loja ADD COLUMN id_venda UUID REFERENCES vendas(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_loja' AND column_name='id_compra') THEN
        ALTER TABLE transacoes_loja ADD COLUMN id_compra UUID REFERENCES compras(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_loja' AND column_name='id_condicional') THEN
        ALTER TABLE transacoes_loja ADD COLUMN id_condicional UUID REFERENCES transacoes_condicionais(id) ON DELETE CASCADE;
    END IF;

END $$;

-- 5. FUNÇÃO DE ATUALIZAÇÃO DE ESTOQUE (CORREÇÃO UUID/INTEGER)
CREATE OR REPLACE FUNCTION public.atualizar_estoque(produto_id_param UUID, quantidade_param INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.produtos SET quantidade = quantidade + quantidade_param WHERE id = produto_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. FUNÇÃO SEQUENCIAL DE TRANSAÇÃO (REFORÇO)
CREATE OR REPLACE FUNCTION public.obter_proximo_numero_transacao()
RETURNS INTEGER AS $$
DECLARE
    max_vendas INTEGER;
    max_compras INTEGER;
    max_condicionais INTEGER;
    max_total INTEGER;
BEGIN
    SELECT COALESCE(MAX(numero_transacao), 0) INTO max_vendas FROM public.vendas;
    SELECT COALESCE(MAX(numero_transacao), 0) INTO max_compras FROM public.compras;
    SELECT COALESCE(MAX(numero_transacao), 0) INTO max_condicionais FROM public.transacoes_condicionais;

    max_total := GREATEST(max_vendas, max_compras, max_condicionais);
    RETURN max_total + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NOTIFICAÇÃO PARA REFRESH DO CACHE DO POSTGREST
NOTIFY pgrst, 'reload schema';
