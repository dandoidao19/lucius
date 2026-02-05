-- ============================================
-- SQL PARA ADICIONAR CAMPO VALOR_REPASSE
-- ============================================

-- Adiciona a coluna 'valor_repasse' na tabela 'itens_compra'
ALTER TABLE public.itens_compra
ADD COLUMN valor_repasse NUMERIC(10, 2);

-- Adiciona a coluna 'valor_repasse' na tabela 'itens_venda'
ALTER TABLE public.itens_venda
ADD COLUMN valor_repasse NUMERIC(10, 2);

-- Adiciona a coluna 'valor_repasse' na tabela 'produtos' (se já não existir)
-- Esta coluna já existe, mas garantimos aqui por segurança.
DO $$
BEGIN
  IF NOT EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='produtos' and column_name='valor_repasse')
  THEN
      ALTER TABLE "public"."produtos" ADD COLUMN "valor_repasse" numeric(10,2);
  END IF;
END $$;


-- ============================================
-- INSTRUÇÕES DE USO:
-- ============================================
-- 1. Acesse seu projeto no Supabase (https://supabase.com)
-- 2. Vá em "SQL Editor" no menu lateral
-- 3. Clique em "New query"
-- 4. Copie e cole TODO este código
-- 5. Clique em "Run" (ou pressione Ctrl+Enter)
-- 6. Aguarde a confirmação de sucesso
-- ============================================
