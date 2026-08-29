-- ============================================================
-- Groot — Aba Casal migration
-- Rodar no Supabase: SQL Editor → New query → Run
-- ============================================================

-- 1. Tabela profiles: mapeia user_id → email (necessário para RLS de convites)
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler profiles (para busca de email)
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT TO authenticated USING (true);

-- Cada usuário insere/atualiza só o próprio profile
DROP POLICY IF EXISTS "profiles_upsert" ON profiles;
CREATE POLICY "profiles_upsert"
  ON profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Tabela couple_invites: sistema de convites entre casais
CREATE TABLE IF NOT EXISTS couple_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  invitee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(inviter_id, invitee_email)
);

ALTER TABLE couple_invites ENABLE ROW LEVEL SECURITY;

-- Quem convidou gerencia seus próprios convites
DROP POLICY IF EXISTS "couple_inviter_all" ON couple_invites;
CREATE POLICY "couple_inviter_all"
  ON couple_invites FOR ALL TO authenticated
  USING (auth.uid() = inviter_id)
  WITH CHECK (auth.uid() = inviter_id);

-- Convidado pode ver convites endereçados ao seu email
DROP POLICY IF EXISTS "couple_invitee_select" ON couple_invites;
CREATE POLICY "couple_invitee_select"
  ON couple_invites FOR SELECT TO authenticated
  USING (
    invitee_email = (SELECT email FROM profiles WHERE user_id = auth.uid())
  );

-- Convidado pode aceitar/rejeitar (atualiza status + invitee_id)
DROP POLICY IF EXISTS "couple_invitee_update" ON couple_invites;
CREATE POLICY "couple_invitee_update"
  ON couple_invites FOR UPDATE TO authenticated
  USING (invitee_email = (SELECT email FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (invitee_email = (SELECT email FROM profiles WHERE user_id = auth.uid()));

-- 3. Budgets: adiciona política para parceiro(a) ler os dados do outro
--    (a política existente continua — essa é adicional, OR'd pelo Postgres)
DROP POLICY IF EXISTS "partners_read_budgets" ON budgets;
CREATE POLICY "partners_read_budgets"
  ON budgets FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM couple_invites ci
      WHERE ci.status = 'accepted'
        AND (
          (ci.inviter_id = auth.uid() AND ci.invitee_id = user_id)
          OR (ci.invitee_id = auth.uid() AND ci.inviter_id = user_id)
        )
    )
  );
