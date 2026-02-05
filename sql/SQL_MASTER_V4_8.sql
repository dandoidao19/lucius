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

    -- 1. GARANTIR QUE A TABELA DE SEQUÊNCIA EXISTE E ESTÁ CONFIGURADA
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sequencia_transacoes') THEN
        CREATE TABLE public.sequencia_transacoes (
            id SERIAL PRIMARY KEY,
            ultimo_numero INTEGER NOT NULL,
            atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
        );

        -- Inicializar com 163 (conforme solicitado pelo usuário)
        INSERT INTO public.sequencia_transacoes (ultimo_numero) VALUES (163);
    ELSE
        -- Se já existir, garantir que o valor seja pelo menos 163 se estiver menor
        UPDATE public.sequencia_transacoes
        SET ultimo_numero = 163
        WHERE ultimo_numero < 163;
    END IF;

END $$;

-- 2. ATUALIZAR FUNÇÃO PARA USAR A TABELA SEQUENCIA_TRANSACOES
CREATE OR REPLACE FUNCTION public.obter_proximo_numero_transacao()
RETURNS INTEGER AS $$
DECLARE
    proximo_num INTEGER;
BEGIN
    -- Bloqueia a linha para evitar concorrência (FOR UPDATE não funciona bem em UPDATE direto, mas o UPDATE bloqueia a linha nativamente no Postgres)
    UPDATE public.sequencia_transacoes
    SET ultimo_numero = ultimo_numero + 1,
        atualizado_em = now()
    WHERE id = (SELECT id FROM public.sequencia_transacoes LIMIT 1)
    RETURNING ultimo_numero INTO proximo_num;

    RETURN proximo_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NOTIFICAÇÃO PARA REFRESH DO CACHE
NOTIFY pgrst, 'reload schema';
