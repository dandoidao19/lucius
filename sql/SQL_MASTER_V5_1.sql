-- LUCIUS v5.1 - CORREÇÕES DE INTEGRIDADE E ESTOQUE
ALTER TABLE public.transacoes_condicionais ADD COLUMN IF NOT EXISTS quantidade_itens INTEGER DEFAULT 0;

-- 1. Função para recalcular a contagem de itens em transações existentes (Request 7)
CREATE OR REPLACE FUNCTION public.recalcular_quantidade_itens_transacoes()
RETURNS VOID AS $$
BEGIN
    -- Vendas
    UPDATE public.vendas v
    SET quantidade_itens = (
        SELECT COALESCE(SUM(quantidade), 0)
        FROM public.itens_venda iv
        WHERE iv.venda_id = v.id
    );

    -- Compras
    UPDATE public.compras c
    SET quantidade_itens = (
        SELECT COALESCE(SUM(quantidade), 0)
        FROM public.itens_compra ic
        WHERE ic.compra_id = c.id
    );

    -- Pedidos
    UPDATE public.pedidos_loja p
    SET quantidade_itens = (
        SELECT COALESCE(SUM(quantidade), 0)
        FROM public.itens_pedido_loja ipl
        WHERE ipl.pedido_id = p.id
    );

    -- Condicionais (Legado e v4.9+)
    UPDATE public.transacoes_condicionais tc
    SET quantidade_itens = (
        SELECT COALESCE(SUM(quantidade), 0)
        FROM public.itens_condicionais ic
        WHERE ic.transacao_id = tc.id
    );
END;
$$ LANGUAGE plpgsql;

-- 2. Refinamento da função de recalculo de estoque (Request 8)
-- Garante que o estoque seja calculado apenas por transações que REALMENTE afetam o estoque.
CREATE OR REPLACE FUNCTION public.recalcular_estoque_geral()
RETURNS VOID AS $$
DECLARE
    r RECORD;
    v_total_entrada NUMERIC;
    v_total_saida NUMERIC;
BEGIN
    FOR r IN SELECT id FROM public.produtos LOOP
        -- ENTRADAS: Compras Efetivadas + Condicionais Recebidas (não faturadas/canceladas)
        SELECT
            (SELECT COALESCE(SUM(quantidade), 0) FROM public.itens_compra WHERE produto_id = r.id) +
            (SELECT COALESCE(SUM(ic.quantidade), 0)
             FROM public.itens_condicionais ic
             JOIN public.transacoes_condicionais tc ON tc.id = ic.transacao_id
             WHERE ic.produto_id = r.id
               AND tc.tipo = 'recebido'
               AND tc.status = 'pendente'
               AND NOT (COALESCE(tc.observacao, '') ILIKE '%[PEDIDO]%')
            ) INTO v_total_entrada;

        -- SAÍDAS: Vendas Efetivadas + Condicionais Enviadas (não faturadas/canceladas)
        SELECT
            (SELECT COALESCE(SUM(quantidade), 0) FROM public.itens_venda WHERE produto_id = r.id) +
            (SELECT COALESCE(SUM(ic.quantidade), 0)
             FROM public.itens_condicionais ic
             JOIN public.transacoes_condicionais tc ON tc.id = ic.transacao_id
             WHERE ic.produto_id = r.id
               AND tc.tipo = 'enviado'
               AND tc.status = 'pendente'
               AND NOT (COALESCE(tc.observacao, '') ILIKE '%[PEDIDO]%')
            ) INTO v_total_saida;

        -- Atualizar saldo final do produto
        UPDATE public.produtos
        SET quantidade = COALESCE(v_total_entrada, 0) - COALESCE(v_total_saida, 0)
        WHERE id = r.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Executar correções
SELECT public.recalcular_quantidade_itens_transacoes();
SELECT public.recalcular_estoque_geral();
