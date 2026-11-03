-- ========================================
-- Annona Mercis WMS - Migration 024
-- Uma linha de inventário só é considerada fisicamente contada após confirmação explícita
-- ========================================

-- counted_at deixa de significar "linha criada" e passa a significar
-- "quantidade física confirmada pelo operador".
ALTER TABLE public.stock_count_lines
  ALTER COLUMN counted_at DROP NOT NULL;

ALTER TABLE public.stock_count_lines
  ALTER COLUMN counted_at DROP DEFAULT;

-- Contagens ainda abertas no ambiente de homologação foram criadas sob a regra antiga,
-- na qual counted_at era preenchido automaticamente. Elas devem ser reconfirmadas.
UPDATE public.stock_count_lines scl
   SET counted_at = NULL
  FROM public.stock_counts sc
 WHERE sc.id = scl.stock_count_id
   AND sc.status IN ('pending', 'in_progress');

CREATE OR REPLACE FUNCTION public.require_confirmed_stock_count_lines()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND OLD.status IS DISTINCT FROM 'completed'
     AND EXISTS (
       SELECT 1
         FROM public.stock_count_lines scl
        WHERE scl.stock_count_id = NEW.id
          AND scl.counted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'Contagem possui linhas ainda não confirmadas fisicamente';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_confirmed_stock_count_lines_trigger
  ON public.stock_counts;

CREATE TRIGGER require_confirmed_stock_count_lines_trigger
  BEFORE UPDATE OF status ON public.stock_counts
  FOR EACH ROW
  EXECUTE FUNCTION public.require_confirmed_stock_count_lines();
