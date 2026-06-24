-- ==============================================================================
-- SCRIPT PARA HABILITAR REALTIME NAS TABELAS CRÍTICAS DO SISTEMA LUCIUS
-- EXECUTE ESTE SCRIPT NO "SQL EDITOR" DO DASHBOARD SUPABASE
-- ==============================================================================

-- 1. Garantir que a publicação supabase_realtime existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- 2. Adicionar tabelas à publicação (uma a uma para evitar erro se já existir)
-- Nota: O comando 'ALTER PUBLICATION ... ADD TABLE ...' falha se a tabela já estiver lá.
-- Por isso usamos um bloco DO para verificar antes.

DO $$
DECLARE
    tab_name TEXT;
    tabelas_alvo TEXT[] := ARRAY[
        'vendas',
        'compras',
        'transacoes_condicionais',
        'pedidos_loja',
        'transacoes_loja',
        'produtos',
        'movimentacoes_estoque',
        'lancamentos_financeiros'
    ];
BEGIN
    FOREACH tab_name IN ARRAY tabelas_alvo LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tab_name AND table_schema = 'public') THEN
            -- Tentar adicionar a tabela. Se já estiver lá, o PG ignora se usarmos a lógica correta.
            -- No Supabase, é comum usar 'SET TABLE' ou apenas tentar e capturar.
            BEGIN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tab_name);
                RAISE NOTICE 'Tabela % adicionada ao Realtime.', tab_name;
            EXCEPTION WHEN duplicate_object THEN
                RAISE NOTICE 'Tabela % já estava no Realtime.', tab_name;
            END;
        END IF;
    END LOOP;
END $$;

-- 3. Habilitar o log de réplica (necessário para o Realtime capturar o estado anterior se necessário,
-- mas 'FULL' garante que o Realtime funcione melhor em todas as tabelas)
ALTER TABLE public.vendas REPLICA IDENTITY FULL;
ALTER TABLE public.compras REPLICA IDENTITY FULL;
ALTER TABLE public.transacoes_condicionais REPLICA IDENTITY FULL;
ALTER TABLE public.pedidos_loja REPLICA IDENTITY FULL;
ALTER TABLE public.transacoes_loja REPLICA IDENTITY FULL;
ALTER TABLE public.produtos REPLICA IDENTITY FULL;
ALTER TABLE public.movimentacoes_estoque REPLICA IDENTITY FULL;
ALTER TABLE public.lancamentos_financeiros REPLICA IDENTITY FULL;

RAISE NOTICE 'Realtime habilitado com sucesso para as tabelas do sistema.';
