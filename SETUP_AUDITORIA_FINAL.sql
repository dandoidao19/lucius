-- ================================================================
-- SCRIPT DE LIMPEZA E PADRONIZAÇÃO DE AUDITORIA (VERSÃO V4 - FINAL)
-- ================================================================
-- Este script remove duplicidades de gatilhos (triggers) e garante
-- que cada tabela tenha apenas UM registro de auditoria por ação.

-- 1. LIMPEZA PROFUNDA DE GATILHOS ANTIGOS
-- Este bloco identifica e remove QUALQUER gatilho que aponte para a função de auditoria,
-- eliminando duplicidades causadas por scripts anteriores com nomes diferentes.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tgname, relname
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
        AND (
            tgfoid = 'public.process_audit_log'::regproc
            OR tgname ILIKE '%audit%'
        )
        AND relname IN (
            'lancamentos_financeiros', 'transacoes_loja', 'produtos',
            'compras', 'vendas', 'itens_compra', 'itens_venda',
            'transacoes_condicionais'
        )
    ) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', r.tgname, r.relname);
    END LOOP;
END $$;

-- 2. GARANTIR ESTRUTURA DA TABELA (old_record / new_record)
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
            old_record JSONB,
            new_record JSONB
        );
    ELSE
        -- Garantir nomes de colunas compatíveis
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='auditoria' AND column_name='timestamp') THEN
            ALTER TABLE public.auditoria RENAME COLUMN "timestamp" TO data_hora;
        END IF;
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='auditoria' AND column_name='old_data') THEN
            ALTER TABLE public.auditoria RENAME COLUMN "old_data" TO old_record;
        END IF;
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='auditoria' AND column_name='new_data') THEN
            ALTER TABLE public.auditoria RENAME COLUMN "new_data" TO new_record;
        END IF;
    END IF;
END $$;

-- 3. REINSTALAR FUNÇÃO DE AUDITORIA (UNIFICADA)
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_user_email TEXT;
    v_record_id TEXT;
BEGIN
    v_user_id := (auth.uid());
    v_user_email := (auth.jwt() ->> 'email');

    BEGIN
        IF (TG_OP = 'DELETE') THEN v_record_id := OLD.id::text;
        ELSE v_record_id := NEW.id::text;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_record_id := 'unknown';
    END;

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.auditoria (user_id, user_email, action, table_name, record_id, new_record)
        VALUES (v_user_id, v_user_email, TG_OP, TG_TABLE_NAME, v_record_id, to_jsonb(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.auditoria (user_id, user_email, action, table_name, record_id, old_record, new_record)
        VALUES (v_user_id, v_user_email, TG_OP, TG_TABLE_NAME, v_record_id, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.auditoria (user_id, user_email, action, table_name, record_id, old_record)
        VALUES (v_user_id, v_user_email, TG_OP, TG_TABLE_NAME, v_record_id, to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. CRIAR GATILHOS ÚNICOS PADRONIZADOS
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
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            -- Nome padrão único: tr_audit_principal_[nome_da_tabela]
            EXECUTE format('CREATE TRIGGER tr_audit_unique_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.process_audit_log()', t, t);
        END IF;
    END LOOP;
END $$;

-- 5. SEGURANÇA
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.auditoria TO authenticated;
GRANT ALL ON TABLE public.auditoria TO service_role;
GRANT ALL ON TABLE public.auditoria TO postgres;

-- 6. FUNÇÃO DE PRÓXIMO NÚMERO (GARANTIR QUE ESTÁ CORRETA)
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
