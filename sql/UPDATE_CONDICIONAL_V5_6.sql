-- LUCIUS v5.6 - ADEQUAÇÃO DO MÓDULO CONDICIONAL
-- Este script adiciona suporte a estoque condicional separado e faturamento.

DO $$
BEGIN
    -- 1. Adicionar coluna de estoque condicional na tabela de produtos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='produtos' AND column_name='quantidade_condicional') THEN
        ALTER TABLE public.produtos ADD COLUMN quantidade_condicional INTEGER DEFAULT 0;
    END IF;

    -- 2. Garantir que a tabela itens_condicionais tenha preco_custo e preco_venda para faturamento posterior
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_condicionais' AND column_name='preco_custo') THEN
        ALTER TABLE public.itens_condicionais ADD COLUMN preco_custo NUMERIC(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_condicionais' AND column_name='preco_venda') THEN
        ALTER TABLE public.itens_condicionais ADD COLUMN preco_venda NUMERIC(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_condicionais' AND column_name='valor_repasse') THEN
        ALTER TABLE public.itens_condicionais ADD COLUMN valor_repasse NUMERIC(15,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='itens_condicionais' AND column_name='categoria') THEN
        ALTER TABLE public.itens_condicionais ADD COLUMN categoria TEXT;
    END IF;
END $$;

-- 3. Função para atualizar estoque condicional
CREATE OR REPLACE FUNCTION public.atualizar_estoque_condicional(produto_id_param UUID, quantidade_param INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.produtos SET quantidade_condicional = quantidade_condicional + quantidade_param WHERE id = produto_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Refinar função de recalculo de estoque para separar Realizado de Condicional
CREATE OR REPLACE FUNCTION public.recalcular_estoque_geral_v2()
RETURNS VOID AS $$
DECLARE
    r RECORD;
    v_total_entrada NUMERIC;
    v_total_saida NUMERIC;
    v_cond_entrada NUMERIC;
    v_cond_saida NUMERIC;
BEGIN
    FOR r IN SELECT id FROM public.produtos LOOP
        -- ESTOQUE REALIZADO (Vendas e Compras Efetivadas)
        SELECT COALESCE(SUM(quantidade), 0) INTO v_total_entrada FROM public.itens_compra WHERE produto_id = r.id;
        SELECT COALESCE(SUM(quantidade), 0) INTO v_total_saida FROM public.itens_venda WHERE produto_id = r.id;

        -- ESTOQUE CONDICIONAL (Pendentes)
        -- Recebido de fornecedor (Entra no condicional positivo)
        SELECT COALESCE(SUM(ic.quantidade), 0)
        FROM public.itens_condicionais ic
        JOIN public.transacoes_condicionais tc ON tc.id = ic.transacao_id
        WHERE ic.produto_id = r.id
          AND tc.tipo = 'recebido'
          AND tc.status = 'pendente'
          AND NOT (COALESCE(tc.observacao, '') ILIKE '%[PEDIDO]%')
        INTO v_cond_entrada;

        -- Enviado para cliente (Sai do estoque condicional - negativo)
        SELECT COALESCE(SUM(ic.quantidade), 0)
        FROM public.itens_condicionais ic
        JOIN public.transacoes_condicionais tc ON tc.id = ic.transacao_id
        WHERE ic.produto_id = r.id
          AND tc.tipo = 'enviado'
          AND tc.status = 'pendente'
          AND NOT (COALESCE(tc.observacao, '') ILIKE '%[PEDIDO]%')
        INTO v_cond_saida;

        UPDATE public.produtos
        SET
            quantidade = COALESCE(v_total_entrada, 0) - COALESCE(v_total_saida, 0),
            quantidade_condicional = COALESCE(v_cond_entrada, 0) - COALESCE(v_cond_saida, 0)
        WHERE id = r.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Executar recalculo inicial
SELECT public.recalcular_estoque_geral_v2();
