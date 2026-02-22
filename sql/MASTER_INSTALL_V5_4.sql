-- LUCIUS MASTER INSTALLATION SCRIPT v5.4
-- Este script consolida TODAS as alterações de banco de dados necessárias até a v5.4.
-- Execute-o integralmente no SQL Editor do seu Supabase.

-- 1. ADIÇÃO DE COLUNAS FALTANTES (v5.0 - v5.4)
DO $$
BEGIN
    -- Vendas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='acrescimo') THEN
        ALTER TABLE public.vendas ADD COLUMN acrescimo NUMERIC(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='desconto') THEN
        ALTER TABLE public.vendas ADD COLUMN desconto NUMERIC(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='data_vencimento') THEN
        ALTER TABLE public.vendas ADD COLUMN data_vencimento DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='quantidade_itens') THEN
        ALTER TABLE public.vendas ADD COLUMN quantidade_itens INTEGER DEFAULT 0;
    END IF;

    -- Compras
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='acrescimo') THEN
        ALTER TABLE public.compras ADD COLUMN acrescimo NUMERIC(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='desconto') THEN
        ALTER TABLE public.compras ADD COLUMN desconto NUMERIC(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='data_vencimento') THEN
        ALTER TABLE public.compras ADD COLUMN data_vencimento DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='quantidade_itens') THEN
        ALTER TABLE public.compras ADD COLUMN quantidade_itens INTEGER DEFAULT 0;
    END IF;

    -- Pedidos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pedidos_loja' AND column_name='acrescimo') THEN
        ALTER TABLE public.pedidos_loja ADD COLUMN acrescimo NUMERIC(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pedidos_loja' AND column_name='desconto') THEN
        ALTER TABLE public.pedidos_loja ADD COLUMN desconto NUMERIC(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pedidos_loja' AND column_name='quantidade_itens') THEN
        ALTER TABLE public.pedidos_loja ADD COLUMN quantidade_itens INTEGER DEFAULT 0;
    END IF;

    -- Condicionais
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_condicionais' AND column_name='acrescimo') THEN
        ALTER TABLE public.transacoes_condicionais ADD COLUMN acrescimo NUMERIC(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_condicionais' AND column_name='desconto') THEN
        ALTER TABLE public.transacoes_condicionais ADD COLUMN desconto NUMERIC(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_condicionais' AND column_name='data_vencimento') THEN
        ALTER TABLE public.transacoes_condicionais ADD COLUMN data_vencimento DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_condicionais' AND column_name='quantidade_itens') THEN
        ALTER TABLE public.transacoes_condicionais ADD COLUMN quantidade_itens INTEGER DEFAULT 0;
    END IF;
END $$;

-- 2. FUNÇÕES DE MANUTENÇÃO (v5.4)

-- Sincronizar Totais e Contagens
CREATE OR REPLACE FUNCTION public.manutencao_geral_v5_4()
RETURNS VOID AS $$
BEGIN
    -- Vendas
    UPDATE public.vendas v
    SET
      total = (SELECT COALESCE(SUM(quantidade * preco_venda), 0) FROM itens_venda WHERE venda_id = v.id) + COALESCE(acrescimo, 0) - COALESCE(desconto, 0),
      quantidade_itens = (SELECT COALESCE(SUM(quantidade), 0) FROM itens_venda WHERE venda_id = v.id);

    -- Compras
    UPDATE public.compras c
    SET
      total = (SELECT COALESCE(SUM(quantidade * valor_repasse), 0) FROM itens_compra WHERE compra_id = c.id) + COALESCE(acrescimo, 0) - COALESCE(desconto, 0),
      quantidade_itens = (SELECT COALESCE(SUM(quantidade), 0) FROM itens_compra WHERE compra_id = c.id);

    -- Pedidos
    UPDATE public.pedidos_loja p
    SET
      total_geral = (SELECT COALESCE(SUM(quantidade * (CASE WHEN p.tipo = 'venda' THEN preco_venda ELSE valor_repasse END)), 0) FROM itens_pedido_loja WHERE pedido_id = p.id) + COALESCE(acrescimo, 0) - COALESCE(desconto, 0),
      total_financeiro = (SELECT COALESCE(SUM(quantidade * (CASE WHEN p.tipo = 'venda' THEN preco_venda ELSE valor_repasse END)), 0) FROM itens_pedido_loja WHERE pedido_id = p.id AND status = 'pendente') + COALESCE(acrescimo, 0) - COALESCE(desconto, 0),
      quantidade_itens = (SELECT COALESCE(SUM(quantidade), 0) FROM itens_pedido_loja WHERE pedido_id = p.id AND status = 'pendente');

    -- Condicionais
    UPDATE public.transacoes_condicionais tc
    SET
      total = (SELECT COALESCE(SUM(quantidade * (CASE WHEN tc.tipo = 'enviado' THEN preco_venda ELSE valor_repasse END)), 0) FROM itens_condicionais WHERE transacao_id = tc.id) + COALESCE(acrescimo, 0) - COALESCE(desconto, 0),
      quantidade_itens = (SELECT COALESCE(SUM(quantidade), 0) FROM itens_condicionais WHERE transacao_id = tc.id);

    -- Atualizar status de pedidos completos
    UPDATE public.pedidos_loja p
    SET status = 'faturado'
    WHERE (SELECT COUNT(*) FROM itens_pedido_loja WHERE pedido_id = p.id AND status = 'pendente') = 0
    AND status != 'cancelado'
    AND (SELECT COUNT(*) FROM itens_pedido_loja WHERE pedido_id = p.id) > 0;
END;
$$ LANGUAGE plpgsql;

-- 3. RECALCULO DE ESTOQUE (v5.1/v5.4)
CREATE OR REPLACE FUNCTION public.recalcular_estoque_geral()
RETURNS VOID AS $$
DECLARE
    r RECORD;
    v_total_entrada NUMERIC;
    v_total_saida NUMERIC;
BEGIN
    FOR r IN SELECT id FROM public.produtos LOOP
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

        UPDATE public.produtos SET quantidade = COALESCE(v_total_entrada, 0) - COALESCE(v_total_saida, 0) WHERE id = r.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- EXECUTAR TUDO
SELECT public.manutencao_geral_v5_4();
SELECT public.recalcular_estoque_geral();
