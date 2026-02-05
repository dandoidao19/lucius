-- ==============================================================================
-- SCRIPT SQL NUCLEAR LUCIUS V4.9 - SISTEMA DE FATURAMENTO DE PEDIDOS
-- EXECUTE ESTE SCRIPT NO "SQL EDITOR" DO SEU DASHBOARD SUPABASE
-- ==============================================================================

DO $$
BEGIN
    -- 1. CRIAR TABELA DE PEDIDOS (INDEPENDENTE DO CONDICIONAL)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pedidos_loja') THEN
        CREATE TABLE public.pedidos_loja (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            numero_transacao INTEGER NOT NULL,
            tipo TEXT CHECK (tipo IN ('venda', 'compra')),
            data_pedido DATE NOT NULL,
            entidade TEXT NOT NULL,
            total_geral NUMERIC(15,2) DEFAULT 0,
            total_financeiro NUMERIC(15,2) DEFAULT 0,
            status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'parcial', 'faturado', 'cancelado')),
            quantidade_parcelas INTEGER DEFAULT 1,
            prazoparcelas TEXT,
            data_vencimento DATE,
            observacao TEXT,
            user_id UUID REFERENCES auth.users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );

        -- Habilitar RLS
        ALTER TABLE public.pedidos_loja ENABLE ROW LEVEL SECURITY;

        -- Políticas básicas
        CREATE POLICY "Permitir tudo para usuários autenticados em pedidos_loja"
        ON public.pedidos_loja FOR ALL USING (auth.role() = 'authenticated');
    END IF;

    -- 2. CRIAR TABELA DE ITENS DO PEDIDO
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'itens_pedido_loja') THEN
        CREATE TABLE public.itens_pedido_loja (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            pedido_id UUID REFERENCES public.pedidos_loja(id) ON DELETE CASCADE,
            produto_id UUID REFERENCES public.produtos(id),
            descricao TEXT,
            quantidade INTEGER DEFAULT 0,
            preco_venda NUMERIC(15,2) DEFAULT 0,
            preco_custo NUMERIC(15,2) DEFAULT 0,
            valor_repasse NUMERIC(15,2) DEFAULT 0,
            categoria TEXT,
            status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'efetuado', 'cancelado')),
            observacao_item TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );

        -- Habilitar RLS
        ALTER TABLE public.itens_pedido_loja ENABLE ROW LEVEL SECURITY;

        -- Políticas básicas
        CREATE POLICY "Permitir tudo para usuários autenticados em itens_pedido_loja"
        ON public.itens_pedido_loja FOR ALL USING (auth.role() = 'authenticated');
    END IF;

    -- 3. ADICIONAR VÍNCULO EM TRANSACOES_LOJA
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_loja' AND column_name='id_pedido') THEN
        ALTER TABLE public.transacoes_loja ADD COLUMN id_pedido UUID REFERENCES public.pedidos_loja(id) ON DELETE CASCADE;
    END IF;

    -- 4. ADICIONAR VÍNCULO EM VENDAS E COMPRAS PARA RASTREABILIDADE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='pedido_origem_id') THEN
        ALTER TABLE public.vendas ADD COLUMN pedido_origem_id UUID REFERENCES public.pedidos_loja(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='pedido_origem_id') THEN
        ALTER TABLE public.compras ADD COLUMN pedido_origem_id UUID REFERENCES public.pedidos_loja(id);
    END IF;

END $$;

-- NOTIFICAÇÃO PARA REFRESH DO CACHE
NOTIFY pgrst, 'reload schema';
