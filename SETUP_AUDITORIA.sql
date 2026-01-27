-- ============================================
-- SQL PARA CONFIGURAÇÃO DO LOG DE AUDITORIA
-- ============================================

-- 1. Criar a tabela de auditoria se não existir
CREATE TABLE IF NOT EXISTS public.auditoria (
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

-- 2. Habilitar RLS na tabela de auditoria
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- 3. Criar política para permitir que usuários autenticados leiam os logs
-- (Ajuste conforme sua necessidade de segurança)
CREATE POLICY "Permitir leitura para usuários autenticados"
ON public.auditoria FOR SELECT
TO authenticated
USING (true);

-- Adicionar permissões explícitas de acesso
GRANT ALL ON TABLE public.auditoria TO authenticated;
GRANT ALL ON TABLE public.auditoria TO service_role;
GRANT ALL ON TABLE public.auditoria TO postgres;

-- 4. Função principal de auditoria
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_user_email TEXT;
BEGIN
    -- Tentar obter ID e Email do usuário da sessão do Supabase
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

-- 5. Aplicar Triggers nas tabelas principais

-- Lançamentos Financeiros
DROP TRIGGER IF EXISTS tr_audit_lancamentos ON public.lancamentos_financeiros;
CREATE TRIGGER tr_audit_lancamentos
AFTER INSERT OR UPDATE OR DELETE ON public.lancamentos_financeiros
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- Transações Loja
DROP TRIGGER IF EXISTS tr_audit_transacoes_loja ON public.transacoes_loja;
CREATE TRIGGER tr_audit_transacoes_loja
AFTER INSERT OR UPDATE OR DELETE ON public.transacoes_loja
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- Produtos
DROP TRIGGER IF EXISTS tr_audit_produtos ON public.produtos;
CREATE TRIGGER tr_audit_produtos
AFTER INSERT OR UPDATE OR DELETE ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- Compras
DROP TRIGGER IF EXISTS tr_audit_compras ON public.compras;
CREATE TRIGGER tr_audit_compras
AFTER INSERT OR UPDATE OR DELETE ON public.compras
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- Vendas
DROP TRIGGER IF EXISTS tr_audit_vendas ON public.vendas;
CREATE TRIGGER tr_audit_vendas
AFTER INSERT OR UPDATE OR DELETE ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- Transações Condicionais
DROP TRIGGER IF EXISTS tr_audit_condicionais ON public.transacoes_condicionais;
CREATE TRIGGER tr_audit_condicionais
AFTER INSERT OR UPDATE OR DELETE ON public.transacoes_condicionais
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 6. Função para obter o próximo número de transação sequencial
-- Necessária para o funcionamento dos lançamentos avulsos
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

-- ============================================
-- INSTRUÇÕES DE USO:
-- ============================================
-- 1. Acesse seu projeto no Supabase (https://supabase.com)
-- 2. Vá em "SQL Editor" no menu lateral
-- 3. Clique em "New query"
-- 4. Copie e cole TODO este código
-- 5. Clique em "Run"
-- ============================================
