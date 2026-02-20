-- LUCIUS v5.0 - CORREÇÕES E MELHORIAS
-- 1. Adicionar colunas de acréscimo, desconto e data_vencimento
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS acrescimo NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS desconto NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS data_vencimento DATE;

ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS acrescimo NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS desconto NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS data_vencimento DATE;

ALTER TABLE public.pedidos_loja ADD COLUMN IF NOT EXISTS acrescimo NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.pedidos_loja ADD COLUMN IF NOT EXISTS desconto NUMERIC(15,2) DEFAULT 0;

ALTER TABLE public.transacoes_condicionais ADD COLUMN IF NOT EXISTS acrescimo NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.transacoes_condicionais ADD COLUMN IF NOT EXISTS desconto NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.transacoes_condicionais ADD COLUMN IF NOT EXISTS data_vencimento DATE;

-- 2. Script de Recalcular Estoque (Request 8)
-- Este script varre todas as transações efetivas e recalcula o saldo real de cada produto.
CREATE OR REPLACE FUNCTION public.recalcular_estoque_geral()
RETURNS VOID AS $$
DECLARE
    r RECORD;
    v_entrada NUMERIC;
    v_saida NUMERIC;
BEGIN
    FOR r IN SELECT id FROM public.produtos LOOP
        -- Entradas (Compras)
        SELECT COALESCE(SUM(quantidade), 0) INTO v_entrada
        FROM public.itens_compra
        WHERE produto_id = r.id;

        -- Saídas (Vendas)
        SELECT COALESCE(SUM(quantidade), 0) INTO v_saida
        FROM public.itens_venda
        WHERE produto_id = r.id;

        -- Condicionais Recebidas (Entrada) - Exceto Pedidos
        SELECT v_entrada + COALESCE(SUM(ic.quantidade), 0) INTO v_entrada
        FROM public.itens_condicionais ic
        JOIN public.transacoes_condicionais tc ON tc.id = ic.transacao_id
        WHERE ic.produto_id = r.id
          AND tc.tipo = 'recebido'
          AND tc.status = 'pendente'
          AND NOT (COALESCE(tc.observacao, '') ILIKE '%[PEDIDO]%');

        -- Condicionais Enviadas (Saída) - Exceto Pedidos
        SELECT v_saida + COALESCE(SUM(ic.quantidade), 0) INTO v_saida
        FROM public.itens_condicionais ic
        JOIN public.transacoes_condicionais tc ON tc.id = ic.transacao_id
        WHERE ic.produto_id = r.id
          AND tc.tipo = 'enviado'
          AND tc.status = 'pendente'
          AND NOT (COALESCE(tc.observacao, '') ILIKE '%[PEDIDO]%');

        -- Atualizar o produto
        UPDATE public.produtos
        SET quantidade = v_entrada - v_saida
        WHERE id = r.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Executar a função uma vez para corrigir o estado atual
SELECT public.recalcular_estoque_geral();
