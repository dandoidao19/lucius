-- ==============================================================================
-- SCRIPT SQL NUCLEAR LUCIUS V4.8 - SEQUENCIA_TRANSACOES TABLE INTEGRATION
-- EXECUTE ESTE SCRIPT NO "SQL EDITOR" DO SEU DASHBOARD SUPABASE
-- ==============================================================================

DO $$
BEGIN
    -- 0. REMOVER CONSTRAINT DE UNICIDADE EM TRANSACOES_LOJA (SE EXISTIR)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transacoes_loja_numero_transacao_key') THEN
        ALTER TABLE public.transacoes_loja DROP CONSTRAINT transacoes_loja_numero_transacao_key;
    END IF;

    -- 0.1 GARANTIR COLUNAS DE SCHEMA (V3.5 ~ V4.8)
    -- Transacoes Loja
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_loja' AND column_name='quantidade_parcelas') THEN
        ALTER TABLE public.transacoes_loja ADD COLUMN quantidade_parcelas INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_loja' AND column_name='user_id') THEN
        ALTER TABLE public.transacoes_loja ADD COLUMN user_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_loja' AND column_name='observacao') THEN
        ALTER TABLE public.transacoes_loja ADD COLUMN observacao TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_loja' AND column_name='id_venda') THEN
        ALTER TABLE public.transacoes_loja ADD COLUMN id_venda UUID REFERENCES public.vendas(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_loja' AND column_name='id_compra') THEN
        ALTER TABLE public.transacoes_loja ADD COLUMN id_compra UUID REFERENCES public.compras(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_loja' AND column_name='id_condicional') THEN
        ALTER TABLE public.transacoes_loja ADD COLUMN id_condicional UUID REFERENCES public.transacoes_condicionais(id) ON DELETE CASCADE;
    END IF;

    -- Vendas e Compras (Garantir quantidade_parcelas)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='quantidade_parcelas') THEN
        ALTER TABLE public.vendas ADD COLUMN quantidade_parcelas INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='quantidade_parcelas') THEN
        ALTER TABLE public.compras ADD COLUMN quantidade_parcelas INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_condicionais' AND column_name='quantidade_parcelas') THEN
        ALTER TABLE public.transacoes_condicionais ADD COLUMN quantidade_parcelas INTEGER DEFAULT 1;
    END IF;

    -- 1. GARANTIR QUE A TABELA DE SEQUÊNCIA EXISTE E ESTÁ CONFIGURADA
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sequencia_transacoes') THEN
        CREATE TABLE public.sequencia_transacoes (
            id SERIAL PRIMARY KEY,
            proximo_numero INTEGER NOT NULL,
            atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
        );

        -- Inicializar com 163 (conforme solicitado pelo usuário)
        INSERT INTO public.sequencia_transacoes (proximo_numero) VALUES (163);
    ELSE
        -- Se a tabela existe mas com o nome antigo 'ultimo_numero', renomear
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sequencia_transacoes' AND column_name='ultimo_numero') THEN
            ALTER TABLE public.sequencia_transacoes RENAME COLUMN ultimo_numero TO proximo_numero;
        END IF;

        -- Garantir que a coluna atualizado_em existe
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sequencia_transacoes' AND column_name='atualizado_em') THEN
            ALTER TABLE public.sequencia_transacoes ADD COLUMN atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT now();
        END IF;

        -- Se já existir, garantir que o valor seja pelo menos 163 se estiver menor
        UPDATE public.sequencia_transacoes
        SET proximo_numero = 163
        WHERE proximo_numero < 163;
    END IF;

    -- 2. GARANTIR SEQUÊNCIA PARA CÓDIGOS DE PRODUTO
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'seq_codigo_produto') THEN
        CREATE SEQUENCE public.seq_codigo_produto START WITH 1000;
    END IF;

    -- 3. CONFIGURAR GERAÇÃO AUTOMÁTICA DE CÓDIGO DE PRODUTO
    ALTER TABLE public.produtos ALTER COLUMN codigo SET DEFAULT 'P' || lpad(nextval('public.seq_codigo_produto')::text, 6, '0');

END $$;

-- 4. FUNÇÃO DE ATUALIZAÇÃO DE ESTOQUE
CREATE OR REPLACE FUNCTION public.atualizar_estoque(produto_id_param UUID, quantidade_param INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.produtos SET quantidade = quantidade + quantidade_param WHERE id = produto_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. ATUALIZAR FUNÇÃO PARA USAR A TABELA SEQUENCIA_TRANSACOES
CREATE OR REPLACE FUNCTION public.obter_proximo_numero_transacao()
RETURNS INTEGER AS $$
DECLARE
    v_numero INTEGER;
BEGIN
    -- Bloqueia a linha para evitar concorrência (FOR UPDATE não funciona bem em UPDATE direto, mas o UPDATE bloqueia a linha nativamente no Postgres)
    -- Incrementamos o valor mas retornamos o valor ANTERIOR (comportamento de 'próximo número' disponível)
    UPDATE public.sequencia_transacoes
    SET proximo_numero = proximo_numero + 1,
        atualizado_em = now()
    WHERE id = (SELECT id FROM public.sequencia_transacoes LIMIT 1)
    RETURNING (proximo_numero - 1) INTO v_numero;

    RETURN v_numero;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NOTIFICAÇÃO PARA REFRESH DO CACHE
NOTIFY pgrst, 'reload schema';
