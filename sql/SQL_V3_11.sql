-- ==============================================================================
-- SCRIPT SQL LUCIUS V3.11 - PERSISTÊNCIA FINANCEIRA EM PEDIDOS
-- ==============================================================================

DO $$
BEGIN
    -- 1. ADICIONAR COLUNAS DE PARCELAMENTO EM TRANSACOES_CONDICIONAIS
    -- Isso permite que pedidos lembrem como foram parcelados ao adicionar novos itens

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

-- NOTIFICAÇÃO PARA REFRESH DO CACHE DO POSTGREST
NOTIFY pgrst, 'reload schema';
