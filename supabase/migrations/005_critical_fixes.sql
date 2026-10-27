-- ========================================
-- WMS Casa Meta - Migration 005
-- Compatibilidade da terceira rodada corretiva
-- ========================================
-- Esta migration foi reduzida aos efeitos de schema ainda necessários.
-- As funções transacionais desta rodada são substituídas pelas migrations
-- 006, 007, 008 e 009; manter cópias antigas aqui só reintroduzia bugs.

-- Campo necessário para idempotência na liberação de reservas.
ALTER TABLE public.shipment_lines
  ADD COLUMN IF NOT EXISTS reservations_released BOOLEAN NOT NULL DEFAULT false;

-- Política válida para atualização do próprio perfil.
-- A proteção de role é implementada por trigger na migration 008.
DROP POLICY IF EXISTS "profiles_update_self_limited" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self_safe" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;

CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');
