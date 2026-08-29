-- ============================================================
-- Groot — Share link migration
-- Rodar no Supabase: SQL Editor → New query → Run
-- ============================================================

-- 1. Adiciona coluna share_token na tabela budgets
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT NULL;

-- Índice para busca rápida por token
CREATE INDEX IF NOT EXISTS budgets_share_token_idx
  ON budgets(share_token)
  WHERE share_token IS NOT NULL;

-- 2. Função SECURITY DEFINER: qualquer um pode ler budget pelo token (sem autenticação)
CREATE OR REPLACE FUNCTION public.get_shared_budget(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT data INTO result
  FROM budgets
  WHERE share_token = p_token;
  RETURN result;
END;
$$;

-- Permite que usuário anônimo (sem login) chame a função
GRANT EXECUTE ON FUNCTION public.get_shared_budget(UUID) TO anon, authenticated;
