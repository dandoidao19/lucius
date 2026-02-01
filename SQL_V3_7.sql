-- ==============================================================================
-- SCRIPT SQL LUCIUS V3.7 - ADIÇÃO DE TOTAL EM CONDICIONAIS E AJUSTES DE ITENS
-- ==============================================================================

DO $$
BEGIN
    -- 1. ADICIONAR COLUNA TOTAL EM TRANSACOES_CONDICIONAIS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_condicionais' AND column_name='total') THEN
        ALTER TABLE transacoes_condicionais ADD COLUMN total NUMERIC(10,2) DEFAULT 0;
    END IF;

    -- 2. GARANTIR VALOR_REPASSE EM ITENS_CONDICIONAIS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_condicionais' AND column_name='valor_repasse') THEN
        ALTER TABLE itens_condicionais ADD COLUMN valor_repasse NUMERIC(10,2) DEFAULT 0;
    END IF;

END $$;

NOTIFY pgrst, 'reload schema';
