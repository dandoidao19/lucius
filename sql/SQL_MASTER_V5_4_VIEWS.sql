-- ==============================================================================
-- SCRIPT SQL LUCIUS V5.4 - VIEWS DE VISUALIZAÇÃO UNIFICADA
-- EXECUTE ESTE SCRIPT NO "SQL EDITOR" DO SEU DASHBOARD SUPABASE
-- ESTAS VIEWS FACILITAM A VISUALIZAÇÃO DE TRANSAÇÕES E SEUS ITENS JUNTOS
-- ==============================================================================

-- 1. VIEW DE VENDAS DETALHADAS
CREATE OR REPLACE VIEW public.view_vendas_detalhadas AS
SELECT
    v.numero_transacao,
    v.data_venda,
    v.cliente,
    v.total as total_venda,
    v.status_pagamento,
    i.descricao as item_descricao,
    i.quantidade as item_quantidade,
    i.preco_venda as item_preco_venda,
    (i.quantidade * i.preco_venda) as item_subtotal,
    v.observacao as transacao_obs,
    i.observacao as item_obs,
    v.id as venda_id,
    i.id as item_id
FROM public.vendas v
LEFT JOIN public.itens_venda i ON v.id = i.venda_id
ORDER BY v.data_venda DESC, v.numero_transacao DESC;

-- 2. VIEW DE COMPRAS DETALHADAS
CREATE OR REPLACE VIEW public.view_compras_detalhadas AS
SELECT
    c.numero_transacao,
    c.data_compra,
    c.fornecedor,
    c.total as total_compra,
    c.status_pagamento,
    i.descricao as item_descricao,
    i.quantidade as item_quantidade,
    i.preco_custo as item_preco_custo,
    i.valor_repasse as item_valor_repasse,
    (i.quantidade * i.valor_repasse) as item_subtotal_repasse,
    c.observacao as transacao_obs,
    i.observacao as item_obs,
    c.id as compra_id,
    i.id as item_id
FROM public.compras c
LEFT JOIN public.itens_compra i ON c.id = i.compra_id
ORDER BY c.data_compra DESC, c.numero_transacao DESC;

-- 3. VIEW DE PEDIDOS DETALHADOS
CREATE OR REPLACE VIEW public.view_pedidos_detalhados AS
SELECT
    p.numero_transacao,
    p.tipo as tipo_pedido,
    p.data_pedido,
    p.entidade,
    p.total_geral,
    p.total_financeiro as saldo_pendente,
    p.status as status_pedido,
    i.descricao as item_descricao,
    i.quantidade as item_quantidade,
    i.preco_venda as item_preco_venda,
    i.status as item_status,
    i.observacao_item,
    p.id as pedido_id,
    i.id as item_id
FROM public.pedidos_loja p
LEFT JOIN public.itens_pedido_loja i ON p.id = i.pedido_id
ORDER BY p.data_pedido DESC, p.numero_transacao DESC;

-- 4. VIEW DE CONDICIONAIS DETALHADOS
CREATE OR REPLACE VIEW public.view_condicionais_detalhados AS
SELECT
    t.numero_transacao,
    t.tipo as tipo_condicional,
    t.data_transacao,
    t.origem,
    t.total as total_condicional,
    t.status as status_condicional,
    i.descricao as item_descricao,
    i.quantidade as item_quantidade,
    i.status as item_status,
    t.id as transacao_id,
    i.id as item_id
FROM public.transacoes_condicionais t
LEFT JOIN public.itens_condicionais i ON t.id = i.transacao_id
ORDER BY t.data_transacao DESC, t.numero_transacao DESC;

-- NOTIFICAÇÃO PARA REFRESH DO CACHE
NOTIFY pgrst, 'reload schema';
