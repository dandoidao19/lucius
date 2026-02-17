-- ==============================================================================
-- SCRIPT SQL LUCIUS V5.0 - ACRÉSCIMOS, DESCONTOS E VENCIMENTOS
-- EXECUTE ESTE SCRIPT NO "SQL EDITOR" DO SEU DASHBOARD SUPABASE
-- ==============================================================================

DO $$
BEGIN
    -- 1. ADICIONAR COLUNAS EM VENDAS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='acrescimo') THEN
        ALTER TABLE public.vendas ADD COLUMN acrescimo NUMERIC(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='desconto') THEN
        ALTER TABLE public.vendas ADD COLUMN desconto NUMERIC(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='data_vencimento') THEN
        ALTER TABLE public.vendas ADD COLUMN data_vencimento DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='prazoparcelas') THEN
        ALTER TABLE public.vendas ADD COLUMN prazoparcelas TEXT;
    END IF;

    -- 2. ADICIONAR COLUNAS EM COMPRAS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='acrescimo') THEN
        ALTER TABLE public.compras ADD COLUMN acrescimo NUMERIC(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='desconto') THEN
        ALTER TABLE public.compras ADD COLUMN desconto NUMERIC(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='data_vencimento') THEN
        ALTER TABLE public.compras ADD COLUMN data_vencimento DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='prazoparcelas') THEN
        ALTER TABLE public.compras ADD COLUMN prazoparcelas TEXT;
    END IF;

    -- 3. ADICIONAR COLUNAS EM PEDIDOS_LOJA (data_vencimento e prazoparcelas já existem conforme V4.9, mas vamos garantir)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pedidos_loja' AND column_name='acrescimo') THEN
        ALTER TABLE public.pedidos_loja ADD COLUMN acrescimo NUMERIC(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pedidos_loja' AND column_name='desconto') THEN
        ALTER TABLE public.pedidos_loja ADD COLUMN desconto NUMERIC(15,2) DEFAULT 0;
    END IF;

    -- 4. ADICIONAR COLUNAS EM TRANSACOES_CONDICIONAIS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_condicionais' AND column_name='acrescimo') THEN
        ALTER TABLE public.transacoes_condicionais ADD COLUMN acrescimo NUMERIC(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_condicionais' AND column_name='desconto') THEN
        ALTER TABLE public.transacoes_condicionais ADD COLUMN desconto NUMERIC(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_condicionais' AND column_name='data_vencimento') THEN
        ALTER TABLE public.transacoes_condicionais ADD COLUMN data_vencimento DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_condicionais' AND column_name='prazoparcelas') THEN
        ALTER TABLE public.transacoes_condicionais ADD COLUMN prazoparcelas TEXT;
    END IF;

END $$;

-- NOTIFICAÇÃO PARA REFRESH DO CACHE
NOTIFY pgrst, 'reload schema';
