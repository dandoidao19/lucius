-- ==============================================================================
-- SCRIPT SQL LUCIUS V3.13 - CORREÇÃO DE ESTOQUE E UTILITÁRIO DE SEQUÊNCIA
-- ==============================================================================

-- 1. GARANTIR FUNÇÃO DE ATUALIZAÇÃO DE ESTOQUE
CREATE OR REPLACE FUNCTION public.atualizar_estoque(produto_id_param UUID, quantidade_param INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.produtos
    SET quantidade = quantidade + quantidade_param
    WHERE id = produto_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. CORREÇÃO DE NÚMEROS ALTOS (OPCIONAL/COMENTADO)
-- Se você quiser resetar a sequência para o último número pequeno:
-- DELETE FROM vendas WHERE numero_transacao > 9000000;
-- DELETE FROM compras WHERE numero_transacao > 9000000;
-- DELETE FROM transacoes_loja WHERE numero_transacao > 9000000;
-- DELETE FROM transacoes_condicionais WHERE numero_transacao > 9000000;

-- 3. GARANTIR QUE id_condicional ESTÁ INDEXADO PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_transacoes_loja_id_condicional ON transacoes_loja(id_condicional);

-- NOTIFICAÇÃO PARA REFRESH DO CACHE
NOTIFY pgrst, 'reload schema';
