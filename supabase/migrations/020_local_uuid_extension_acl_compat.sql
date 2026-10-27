-- ========================================
-- WMS Casa Meta - Migration 020
-- Compatibilidade ACL do uuid-ossp em ambiente local
-- ========================================
-- Em Supabase hospedado, uuid-ossp normalmente vive fora de public.
-- Na CI/local PostgreSQL, a extensão pode instalar uuid_generate_v4() em public.
-- A migration 018 revoga EXECUTE de todas as funções públicas; por isso
-- authenticated precisa recuperar acesso somente a este gerador benigno.

DO $$
BEGIN
  IF to_regprocedure('public.uuid_generate_v4()') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.uuid_generate_v4() TO authenticated';
  END IF;
END $$;
