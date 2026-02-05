-- ==============================================================================
-- SCRIPT SQL NUCLEAR LUCIUS V4.7 - AUTOMATIC PRODUCT CODE GENERATION
-- EXECUTE ESTE SCRIPT NO "SQL EDITOR" DO SEU DASHBOARD SUPABASE
-- ESTE SCRIPT É SEGURO: NÃO APAGA DADOS, APENAS SINCRONIZA O CONTADOR E SCHEMA.
-- ==============================================================================

DO $$
BEGIN
    -- 0. REMOVER CONSTRAINT DE UNICIDADE EM TRANSACOES_LOJA (SE EXISTIR)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transacoes_loja_numero_transacao_key') THEN
        ALTER TABLE public.transacoes_loja DROP CONSTRAINT transacoes_loja_numero_transacao_key;
    END IF;

    -- 1. CRIAR OU REINICIAR SEQUÊNCIA PARA NÚMEROS DE TRANSAÇÃO
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'seq_numero_transacao_loja') THEN
        CREATE SEQUENCE public.seq_numero_transacao_loja START WITH 1;
    END IF;

    -- 2. CRIAR SEQUÊNCIA PARA CÓDIGOS DE PRODUTO (NOVO V4.7)
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'seq_codigo_produto') THEN
        CREATE SEQUENCE public.seq_codigo_produto START WITH 1000;
    END IF;

    -- 3. SINCRONIZAR SEQUÊNCIA DE TRANSAÇÃO
    PERFORM setval('public.seq_numero_transacao_loja',
        COALESCE((
            SELECT MAX(max_num) FROM (
                SELECT MAX(numero_transacao) as max_num FROM public.compras WHERE numero_transacao < 500000
                UNION ALL
                SELECT MAX(numero_transacao) as max_num FROM public.vendas WHERE numero_transacao < 500000
                UNION ALL
                SELECT MAX(numero_transacao) as max_num FROM public.transacoes_loja WHERE numero_transacao < 500000
                UNION ALL
                SELECT MAX(numero_transacao) as max_num FROM public.transacoes_condicionais WHERE numero_transacao < 500000
            ) t
        ), 0) + 1, false
    );

    -- 4. GARANTIR COLUNAS V3.5 ~ V4.7
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='user_id') THEN ALTER TABLE vendas ADD COLUMN user_id UUID; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='user_id') THEN ALTER TABLE compras ADD COLUMN user_id UUID; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_condicionais' AND column_name='user_id') THEN ALTER TABLE transacoes_condicionais ADD COLUMN user_id UUID; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='produtos' AND column_name='user_id') THEN ALTER TABLE produtos ADD COLUMN user_id UUID; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_loja' AND column_name='user_id') THEN ALTER TABLE transacoes_loja ADD COLUMN user_id UUID; END IF;

    -- Observação e Vínculos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_loja' AND column_name='observacao') THEN ALTER TABLE transacoes_loja ADD COLUMN observacao TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_loja' AND column_name='id_venda') THEN ALTER TABLE transacoes_loja ADD COLUMN id_venda UUID REFERENCES vendas(id) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_loja' AND column_name='id_compra') THEN ALTER TABLE transacoes_loja ADD COLUMN id_compra UUID REFERENCES compras(id) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_loja' AND column_name='id_condicional') THEN ALTER TABLE transacoes_loja ADD COLUMN id_condicional UUID REFERENCES transacoes_condicionais(id) ON DELETE CASCADE; END IF;

    -- 5. CONFIGURAR GERAÇÃO AUTOMÁTICA DE CÓDIGO DE PRODUTO (NOVO V4.7)
    -- Se a coluna codigo for NOT NULL e não tiver default, vamos dar um default para ela.
    ALTER TABLE public.produtos ALTER COLUMN codigo SET DEFAULT 'P' || lpad(nextval('public.seq_codigo_produto')::text, 6, '0');

END $$;

-- 6. FUNÇÃO DE ATUALIZAÇÃO DE ESTOQUE
CREATE OR REPLACE FUNCTION public.atualizar_estoque(produto_id_param UUID, quantidade_param INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.produtos SET quantidade = quantidade + quantidade_param WHERE id = produto_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. FUNÇÃO SEQUENCIAL DE TRANSAÇÃO
CREATE OR REPLACE FUNCTION public.obter_proximo_numero_transacao()
RETURNS INTEGER AS $$
BEGIN
    RETURN nextval('public.seq_numero_transacao_loja')::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NOTIFICAÇÃO PARA REFRESH DO CACHE
NOTIFY pgrst, 'reload schema';
