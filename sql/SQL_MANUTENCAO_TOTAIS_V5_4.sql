-- LUCIUS v5.4 - SCRIPT DE MANUTENÇÃO E SINCRONIZAÇÃO
-- Este script recalibra os totais e a contagem de peças de todas as transações baseando-se no histórico de itens.

-- 1. Sincronizar VENDAS
UPDATE vendas v
SET
  total = (SELECT COALESCE(SUM(quantidade * preco_venda), 0) FROM itens_venda WHERE venda_id = v.id) + COALESCE(acrescimo, 0) - COALESCE(desconto, 0),
  quantidade_itens = (SELECT COALESCE(SUM(quantidade), 0) FROM itens_venda WHERE venda_id = v.id);

-- 2. Sincronizar COMPRAS
UPDATE compras c
SET
  total = (SELECT COALESCE(SUM(quantidade * valor_repasse), 0) FROM itens_compra WHERE compra_id = c.id) + COALESCE(acrescimo, 0) - COALESCE(desconto, 0),
  quantidade_itens = (SELECT COALESCE(SUM(quantidade), 0) FROM itens_compra WHERE compra_id = c.id);

-- 3. Sincronizar PEDIDOS (Sistema Novo v4.9+)
UPDATE pedidos_loja p
SET
  total_geral = (SELECT COALESCE(SUM(quantidade * (CASE WHEN p.tipo = 'venda' THEN preco_venda ELSE valor_repasse END)), 0) FROM itens_pedido_loja WHERE pedido_id = p.id) + COALESCE(acrescimo, 0) - COALESCE(desconto, 0),
  total_financeiro = (SELECT COALESCE(SUM(quantidade * (CASE WHEN p.tipo = 'venda' THEN preco_venda ELSE valor_repasse END)), 0) FROM itens_pedido_loja WHERE pedido_id = p.id AND status = 'pendente') + COALESCE(acrescimo, 0) - COALESCE(desconto, 0),
  quantidade_itens = (SELECT COALESCE(SUM(quantidade), 0) FROM itens_pedido_loja WHERE pedido_id = p.id AND status = 'pendente');

-- 4. Sincronizar CONDICIONAIS (Sistema Legado)
UPDATE transacoes_condicionais tc
SET
  total = (SELECT COALESCE(SUM(quantidade * (CASE WHEN tc.tipo = 'enviado' THEN preco_venda ELSE valor_repasse END)), 0) FROM itens_condicionais WHERE transacao_id = tc.id) + COALESCE(acrescimo, 0) - COALESCE(desconto, 0),
  quantidade_itens = (SELECT COALESCE(SUM(quantidade), 0) FROM itens_condicionais WHERE transacao_id = tc.id);

-- 5. ATUALIZAR STATUS DE PEDIDOS VAZIOS OU COMPLETOS
UPDATE pedidos_loja p
SET status = 'faturado'
WHERE (SELECT COUNT(*) FROM itens_pedido_loja WHERE pedido_id = p.id AND status = 'pendente') = 0
AND status != 'cancelado';
