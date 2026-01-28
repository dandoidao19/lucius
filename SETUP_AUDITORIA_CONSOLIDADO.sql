-- ================================================================
-- SCRIPT CONSOLIDADO DE AUDITORIA E FUNÇÕES (VERSÃO FINAL)
-- ================================================================
-- Este script configura a tabela de logs, os gatilhos (triggers)
-- e as funções de numeração automática necessárias para o sistema.

-- 1. GARANTIR A TABELA DE AUDITORIA COM ESTRUTURA CORRETA
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auditoria') THEN
        CREATE TABLE public.auditoria (
            id BIGSERIAL PRIMARY KEY,
            data_hora TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            user_id UUID,
            user_email TEXT,
            action TEXT NOT NULL,
            table_name TEXT NOT NULL,
            record_id TEXT NOT NULL,
            old_data JSONB,
            new_data JSONB
        );
    ELSE
        -- Garantir nome correto da coluna de tempo (evitar erro 400 por palavra reservada 'timestamp')
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='auditoria' AND column_name='timestamp') THEN
            ALTER TABLE public.auditoria RENAME COLUMN "timestamp" TO data_hora;
        END IF;
    END IF;
END $$;

-- 2. SEGURANÇA E ACESSOS
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura pública para autenticados" ON public.auditoria;
CREATE POLICY "Leitura pública para autenticados" ON public.auditoria
FOR SELECT TO authenticated USING (true);

GRANT ALL ON TABLE public.auditoria TO authenticated;
GRANT ALL ON TABLE public.auditoria TO service_role;
GRANT ALL ON TABLE public.auditoria TO postgres;

-- 3. FUNÇÃO DE GERAÇÃO DE LOGS (CAPTURANDO NEW E OLD)
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_user_email TEXT;
BEGIN
    v_user_id := (auth.uid());
    v_user_email := (auth.jwt() ->> 'email');

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.auditoria (user_id, user_email, action, table_name, record_id, new_data)
        VALUES (v_user_id, v_user_email, TG_OP, TG_TABLE_NAME, (row_to_json(NEW)->>'id')::text, row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.auditoria (user_id, user_email, action, table_name, record_id, old_data, new_data)
        VALUES (v_user_id, v_user_email, TG_OP, TG_TABLE_NAME, (row_to_json(OLD)->>'id')::text, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.auditoria (user_id, user_email, action, table_name, record_id, old_data)
        VALUES (v_user_id, v_user_email, TG_OP, TG_TABLE_NAME, (row_to_json(OLD)->>'id')::text, row_to_json(OLD)::jsonb);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. APLICAR TRIGGERS EM TODAS AS TABELAS RELEVANTES
DO $$
DECLARE
    t text;
    tables_to_audit text[] := ARRAY[
        'lancamentos_financeiros',
        'transacoes_loja',
        'produtos',
        'compras',
        'vendas',
        'itens_compra',
        'itens_venda',
        'transacoes_condicionais'
    ];
BEGIN
    FOREACH t IN ARRAY tables_to_audit LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS tr_audit_%I ON public.%I', t, t);
        EXECUTE format('CREATE TRIGGER tr_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.process_audit_log()', t, t);
    END LOOP;
END $$;

-- 5. FUNÇÃO DE PRÓXIMO NÚMERO DE TRANSAÇÃO (FIX PARA LANÇAMENTO AVULSO)
CREATE OR REPLACE FUNCTION public.obter_proximo_numero_transacao()
RETURNS INTEGER AS $$
DECLARE
    next_num INTEGER;
BEGIN
    SELECT COALESCE(MAX(max_num), 0) + 1 INTO next_num
    FROM (
        SELECT MAX(numero_transacao) as max_num FROM public.compras
        UNION ALL
        SELECT MAX(numero_transacao) as max_num FROM public.vendas
        UNION ALL
        SELECT MAX(numero_transacao) as max_num FROM public.transacoes_loja
    ) as all_trans;

    RETURN next_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- FIM DO SCRIPT
-- ================================================================
